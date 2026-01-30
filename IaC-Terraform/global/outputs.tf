output "random_suffix" {
  value = random_string.three_letters.result
}

output "project_initials" {
  value = var.project_initials
}

output "deploy_rg" {
  value = var.deploy_rg
}

output "location" {
  value = var.location
}

output "shared_tags" {
  value = var.shared_tags
}

output "client_config_subscription_id" {
  value = data.azurerm_client_config.current.subscription_id
}

output "client_config_tenant_id" {
  value = data.azurerm_client_config.current.tenant_id
}

output "client_config_object_id" {
  value = data.azurerm_client_config.current.object_id
}

output "random_web_key" {
  value = random_id.hex_256.id
}
