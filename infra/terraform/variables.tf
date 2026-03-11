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

variable "redis_url" {
  description = "Redis URL for backend runtime cache/metrics."
  type        = string
  default     = ""
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
  default     = true
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
