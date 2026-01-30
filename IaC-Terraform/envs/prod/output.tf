output "resource_group_name" {
  description = "Resource Group"
  value       = module.global.deploy_rg
}

output "project_prefix" {
  description = "Project Prefix"
  value       = module.global.project_initials
}

output "project_suffix" {
  description = "Project Suffix"
  value       = module.global.random_suffix
}

# OUTPUTS FOR TERRAFORM
output "function_app_name" {
  value       = module.compute.compute_function_name
}

output "static_web_app_name" {
  value       = module.compute.compute_static-wa_name
}

output "key_vault_name" {
  value       = module.security.security_keyvault_name
}

output "app_config_name" {
  value       = module.security.security_appconfig_name
}

output "cosmosdb_name" {
  value       = module.data.db_cosmosdb_name
}

output "api_url" {
  description = "API URL to be used by the front end"
  value       = module.ingress.ingress_api_fqdn
}

output "web_key" {
  description = "Key used on Web Application to get backend configuration"
  value       = module.global.random_web_key
}