output "ecr_repository_url" {
  value       = aws_ecr_repository.api.repository_url
  description = "ECR repository URL for backend container image."
}

output "app_runner_service_arn" {
  value       = try(aws_apprunner_service.api[0].arn, null)
  description = "App Runner service ARN."
}

output "app_runner_service_url" {
  value       = try("https://${aws_apprunner_service.api[0].service_url}", null)
  description = "Public HTTPS URL of backend service."
}

output "ec2_public_ip" {
  value       = try(aws_eip.api[0].public_ip, null)
  description = "EC2 public IP when deployment_target is ec2."
}

output "cloudfront_domain_name" {
  value       = try(aws_cloudfront_distribution.api[0].domain_name, null)
  description = "CloudFront HTTPS domain in front of EC2 backend."
}

output "backend_url" {
  value = var.deployment_target == "ec2" ? (
    var.enable_cloudfront_https ? try("https://${aws_cloudfront_distribution.api[0].domain_name}", null) : try("http://${aws_eip.api[0].public_ip}", null)
  ) : try("https://${aws_apprunner_service.api[0].service_url}", null)
  description = "Backend base URL to set as VITE_API_BASE_URL."
}
