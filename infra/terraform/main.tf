data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }
}

locals {
  use_rds           = var.deployment_target == "ec2" && var.enable_rds
  enable_cloudfront = var.deployment_target == "ec2" && var.enable_cloudfront_https
  use_managed_redis = var.deployment_target == "ec2" && var.enable_managed_redis
  use_local_redis   = var.deployment_target == "ec2" && var.enable_local_redis
  enable_alarms     = var.deployment_target == "ec2" && var.enable_cloudwatch_alarms
  cors_allowed_origins = [
    for origin in split(",", var.allowed_origins) : trimspace(origin)
    if trimspace(origin) != ""
  ]
  effective_database_url = local.use_rds ? format(
    "postgresql+psycopg://%s:%s@%s:5432/%s",
    var.db_username,
    var.db_password,
    aws_db_instance.postgres[0].address,
    var.db_name
  ) : (
    var.deployment_target == "ec2" && var.database_url == "sqlite:///./modelmesh.db" ?
    "sqlite:////opt/modelmesh/data/modelmesh.db" :
    var.database_url
  )
  effective_redis_url = local.use_managed_redis ? format(
    "redis://%s:6379/0",
    aws_elasticache_replication_group.redis[0].primary_endpoint_address
  ) : (local.use_local_redis ? "redis://127.0.0.1:6379/0" : var.redis_url)
  effective_comparison_queue_url = var.deployment_target == "ec2" ? aws_sqs_queue.comparison_jobs.id : ""
  alarm_actions = length(trimspace(var.alert_email)) > 0 ? [aws_sns_topic.alerts[0].arn] : []
}

resource "aws_ecr_repository" "api" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_s3_bucket" "datasets" {
  bucket        = "${var.service_name}-datasets-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "datasets" {
  bucket = aws_s3_bucket.datasets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "datasets" {
  bucket = aws_s3_bucket.datasets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = local.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_sqs_queue" "comparison_jobs" {
  name                       = "${var.service_name}-comparison-jobs"
  visibility_timeout_seconds = 180
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
}

resource "aws_iam_role" "apprunner_ecr_access" {
  count = var.deployment_target == "apprunner" ? 1 : 0
  name  = "${var.service_name}-apprunner-ecr-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  count      = var.deployment_target == "apprunner" ? 1 : 0
  role       = aws_iam_role.apprunner_ecr_access[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

resource "aws_apprunner_auto_scaling_configuration_version" "default" {
  count                           = var.deployment_target == "apprunner" ? 1 : 0
  auto_scaling_configuration_name = "${var.service_name}-autoscaling"
  max_concurrency                 = 100
  max_size                        = 2
  min_size                        = 1
}

resource "aws_apprunner_service" "api" {
  count        = var.deployment_target == "apprunner" ? 1 : 0
  service_name = var.service_name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access[0].arn
    }

    auto_deployments_enabled = false

    image_repository {
      image_identifier      = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "8000"

        runtime_environment_variables = {
          ALLOWED_ORIGINS      = var.allowed_origins
          HF_PROVIDER          = var.hf_provider
          HF_TIMEOUT_SECONDS   = tostring(var.hf_timeout_seconds)
          DATABASE_URL         = var.database_url
          REDIS_URL            = local.effective_redis_url
          DATASET_BUCKET       = aws_s3_bucket.datasets.bucket
          COMPARISON_QUEUE_URL = local.effective_comparison_queue_url
          KAGGLE_USERNAME      = var.kaggle_username
          KAGGLE_KEY           = var.kaggle_key
          API_KEYS             = var.api_keys
          HF_API_TOKEN         = var.hf_api_token
        }
      }
    }
  }

  health_check_configuration {
    path                = "/health"
    protocol            = "HTTP"
    healthy_threshold   = 1
    unhealthy_threshold = 5
    interval            = 10
    timeout             = 5
  }

  instance_configuration {
    cpu    = "1 vCPU"
    memory = "2 GB"
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.default[0].arn
}

resource "aws_iam_role" "ec2_instance_role" {
  count = var.deployment_target == "ec2" ? 1 : 0
  name  = "${var.service_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ecr_read" {
  count      = var.deployment_target == "ec2" ? 1 : 0
  role       = aws_iam_role.ec2_instance_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "ec2_ssm_core" {
  count      = var.deployment_target == "ec2" ? 1 : 0
  role       = aws_iam_role.ec2_instance_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ec2_s3_datasets" {
  count = var.deployment_target == "ec2" ? 1 : 0
  name  = "${var.service_name}-datasets-s3"
  role  = aws_iam_role.ec2_instance_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:AbortMultipartUpload",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.datasets.arn,
          "${aws_s3_bucket.datasets.arn}/*",
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ec2_sqs_comparisons" {
  count = var.deployment_target == "ec2" ? 1 : 0
  name  = "${var.service_name}-comparison-sqs"
  role  = aws_iam_role.ec2_instance_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility",
        ]
        Resource = aws_sqs_queue.comparison_jobs.arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  count = var.deployment_target == "ec2" ? 1 : 0
  name  = "${var.service_name}-ec2-profile"
  role  = aws_iam_role.ec2_instance_role[0].name
}

resource "aws_security_group" "ec2_api" {
  count       = var.deployment_target == "ec2" ? 1 : 0
  name        = "${var.service_name}-ec2-sg"
  description = "Allow HTTP access to ModelMesh API"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  count       = local.use_rds ? 1 : 0
  name        = "${var.service_name}-rds-sg"
  description = "Allow PostgreSQL access from API EC2."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_api[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "default" {
  count      = local.use_rds ? 1 : 0
  name       = "${var.service_name}-db-subnets"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_db_instance" "postgres" {
  count                      = local.use_rds ? 1 : 0
  identifier                 = "${var.service_name}-postgres"
  engine                     = "postgres"
  engine_version             = "16.3"
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  db_name                    = var.db_name
  username                   = var.db_username
  password                   = var.db_password
  db_subnet_group_name       = aws_db_subnet_group.default[0].name
  vpc_security_group_ids     = [aws_security_group.rds[0].id]
  publicly_accessible        = false
  skip_final_snapshot        = true
  backup_retention_period    = 0
  deletion_protection        = false
  auto_minor_version_upgrade = true
}

resource "aws_security_group" "redis" {
  count       = local.use_managed_redis ? 1 : 0
  name        = "${var.service_name}-redis-sg"
  description = "Allow Redis access from API EC2."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_api[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  count      = local.use_managed_redis ? 1 : 0
  name       = "${var.service_name}-redis-subnets"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_elasticache_replication_group" "redis" {
  count                      = local.use_managed_redis ? 1 : 0
  replication_group_id       = "${var.service_name}-redis"
  description                = "ModelMesh managed Redis runtime state"
  engine                     = "redis"
  engine_version             = var.redis_engine_version
  node_type                  = var.redis_node_type
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.redis[0].name
  security_group_ids         = [aws_security_group.redis[0].id]
  automatic_failover_enabled = var.redis_multi_az
  multi_az_enabled           = var.redis_multi_az
  num_cache_clusters         = var.redis_multi_az ? 2 : 1
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false
  apply_immediately          = true
}

resource "aws_instance" "api" {
  count                  = var.deployment_target == "ec2" ? 1 : 0
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.ec2_instance_type
  subnet_id              = tolist(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids = [aws_security_group.ec2_api[0].id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile[0].name

  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    dnf update -y
    dnf install -y docker awscli
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user

    REGION="${data.aws_region.current.name}"
    ACCOUNT_ID="${data.aws_caller_identity.current.account_id}"
    ECR_URI="${aws_ecr_repository.api.repository_url}"
    IMAGE="${aws_ecr_repository.api.repository_url}:${var.image_tag}"

    aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

    if [ "${local.use_local_redis}" = "true" ]; then
      docker rm -f modelmesh-redis || true
      docker run -d --name modelmesh-redis --restart unless-stopped -p 127.0.0.1:6379:6379 redis:7-alpine
    fi

    mkdir -p /opt/modelmesh
    mkdir -p /opt/modelmesh/data
    cat > /opt/modelmesh/.env <<'ENVVARS'
    HF_API_TOKEN=${var.hf_api_token}
    HF_PROVIDER=${var.hf_provider}
    HF_TIMEOUT_SECONDS=${var.hf_timeout_seconds}
    DATABASE_URL=${local.effective_database_url}
    REDIS_URL=${local.effective_redis_url}
    DATASET_BUCKET=${aws_s3_bucket.datasets.bucket}
    COMPARISON_QUEUE_URL=${local.effective_comparison_queue_url}
    ALLOWED_ORIGINS=${var.allowed_origins}
    AWS_REGION=${data.aws_region.current.name}
    KAGGLE_USERNAME=${var.kaggle_username}
    KAGGLE_KEY=${var.kaggle_key}
    API_KEYS=${var.api_keys}
    ENVVARS

    docker pull "$IMAGE"
    docker rm -f modelmesh-api || true
    docker rm -f modelmesh-worker || true
    docker run -d --name modelmesh-api --restart unless-stopped --env-file /opt/modelmesh/.env -v /opt/modelmesh/data:/opt/modelmesh/data -p 80:8000 "$IMAGE"
    docker run -d --name modelmesh-worker --restart unless-stopped --env-file /opt/modelmesh/.env -v /opt/modelmesh/data:/opt/modelmesh/data "$IMAGE" python -m apps.worker.main
  EOT
}

resource "aws_eip" "api" {
  count    = var.deployment_target == "ec2" ? 1 : 0
  domain   = "vpc"
  instance = aws_instance.api[0].id
}

resource "aws_cloudfront_distribution" "api" {
  count = local.enable_cloudfront ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "HTTPS edge for ModelMesh API"
  default_root_object = ""

  origin {
    domain_name = aws_instance.api[0].public_dns
    origin_id   = "modelmesh-ec2-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "modelmesh-ec2-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_sns_topic" "alerts" {
  count = local.enable_alarms && length(trimspace(var.alert_email)) > 0 ? 1 : 0
  name  = "${var.service_name}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  count     = local.enable_alarms && length(trimspace(var.alert_email)) > 0 ? 1 : 0
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "ec2_status_check_failed" {
  count               = local.enable_alarms ? 1 : 0
  alarm_name          = "${var.service_name}-ec2-status-check-failed"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "EC2 instance status checks are failing."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    InstanceId = aws_instance.api[0].id
  }
}

resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  count               = local.enable_alarms ? 1 : 0
  alarm_name          = "${var.service_name}-ec2-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "EC2 CPU utilization is high."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    InstanceId = aws_instance.api[0].id
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  count               = local.enable_alarms && local.use_rds ? 1 : 0
  alarm_name          = "${var.service_name}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization is high."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres[0].id
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  count               = local.enable_alarms && local.use_rds ? 1 : 0
  alarm_name          = "${var.service_name}-rds-free-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2147483648
  alarm_description   = "RDS free storage is below 2 GB."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres[0].id
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  count               = local.enable_alarms && local.use_managed_redis ? 1 : 0
  alarm_name          = "${var.service_name}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ElastiCache Redis CPU utilization is high."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis[0].replication_group_id
  }
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx_high" {
  count               = local.enable_alarms && local.enable_cloudfront ? 1 : 0
  alarm_name          = "${var.service_name}-cloudfront-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "CloudFront 5xx error rate is elevated."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    DistributionId = aws_cloudfront_distribution.api[0].id
    Region         = "Global"
  }
}
