variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "service_name" {
  description = "App Runner service name."
  type        = string
  default     = "modelmesh-api"
}

variable "ecr_repository_name" {
  description = "ECR repository name for backend container."
  type        = string
  default     = "modelmesh-api"
}

variable "image_tag" {
  description = "Container image tag to deploy from ECR."
  type        = string
  default     = "latest"
}

variable "allowed_origins" {
  description = "Comma-separated CORS origins for backend."
  type        = string
}

variable "hf_api_token" {
  description = "Hugging Face API token."
  type        = string
  sensitive   = true
}

variable "kaggle_username" {
  description = "Kaggle username for backend dataset ingestion."
  type        = string
  default     = ""
}

variable "kaggle_key" {
  description = "Kaggle API key for backend dataset ingestion."
  type        = string
  default     = ""
  sensitive   = true
}

variable "hf_provider" {
  description = "Hugging Face inference provider setting."
  type        = string
  default     = "auto"
}

variable "hf_timeout_seconds" {
  description = "Hugging Face request timeout in seconds."
  type        = number
  default     = 45
}

variable "database_url" {
  description = "Database URL for backend."
  type        = string
  default     = "sqlite:///./modelmesh.db"
}

variable "api_keys" {
  description = "Semicolon-separated tenant auth config: tenant_id:api_key:predictions_limit:comparisons_limit:uploads_limit."
  type        = string
  default     = "demo:modelmesh-demo-key:1000:50:100"
  sensitive   = true
}

variable "redis_url" {
  description = "Redis URL for backend runtime cache/metrics."
  type        = string
  default     = ""
}

variable "enable_managed_redis" {
  description = "Enable managed ElastiCache Redis for backend runtime state."
  type        = bool
  default     = false
}

variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_engine_version" {
  description = "Redis engine version for ElastiCache."
  type        = string
  default     = "7.1"
}

variable "redis_multi_az" {
  description = "Enable Multi-AZ and automatic failover for Redis."
  type        = bool
  default     = true
}

variable "deployment_target" {
  description = "Deployment target. Use ec2 or apprunner."
  type        = string
  default     = "ec2"

  validation {
    condition     = contains(["ec2", "apprunner"], var.deployment_target)
    error_message = "deployment_target must be either ec2 or apprunner."
  }
}

variable "enable_rds" {
  description = "Enable RDS PostgreSQL for EC2 deployment."
  type        = bool
  default     = false
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "modelmesh"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "modelmesh_admin"
}

variable "db_password" {
  description = "PostgreSQL master password."
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage (GB)."
  type        = number
  default     = 20
}

variable "enable_cloudfront_https" {
  description = "Enable CloudFront HTTPS in front of EC2 backend."
  type        = bool
  default     = true
}

variable "enable_local_redis" {
  description = "Enable local Redis container on EC2 and wire REDIS_URL."
  type        = bool
  default     = true
}

variable "ec2_instance_type" {
  description = "EC2 instance type for API/worker host."
  type        = string
  default     = "t3.micro"
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for backend infrastructure."
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Optional email address for CloudWatch alarm notifications."
  type        = string
  default     = ""
}
