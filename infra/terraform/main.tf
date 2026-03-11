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
  use_local_redis   = var.deployment_target == "ec2" && var.enable_local_redis
  effective_database_url = local.use_rds ? format(
    "postgresql+psycopg://%s:%s@%s:5432/%s",
    var.db_username,
    var.db_password,
    aws_db_instance.postgres[0].address,
    var.db_name
  ) : var.database_url
  effective_redis_url = local.use_local_redis ? "redis://127.0.0.1:6379/0" : var.redis_url
}

resource "aws_ecr_repository" "api" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
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
          ALLOWED_ORIGINS    = var.allowed_origins
          HF_PROVIDER        = var.hf_provider
          HF_TIMEOUT_SECONDS = tostring(var.hf_timeout_seconds)
          DATABASE_URL       = var.database_url
          REDIS_URL          = var.redis_url
          HF_API_TOKEN       = var.hf_api_token
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

resource "aws_instance" "api" {
  count                  = var.deployment_target == "ec2" ? 1 : 0
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.small"
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
    cat > /opt/modelmesh/.env <<'ENVVARS'
    HF_API_TOKEN=${var.hf_api_token}
    HF_PROVIDER=${var.hf_provider}
    HF_TIMEOUT_SECONDS=${var.hf_timeout_seconds}
    DATABASE_URL=${local.effective_database_url}
    REDIS_URL=${local.effective_redis_url}
    ALLOWED_ORIGINS=${var.allowed_origins}
    ENVVARS

    docker pull "$IMAGE"
    docker rm -f modelmesh-api || true
    docker run -d --name modelmesh-api --restart unless-stopped --env-file /opt/modelmesh/.env -p 80:8000 "$IMAGE"
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
