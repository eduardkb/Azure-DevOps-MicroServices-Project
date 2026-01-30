output "security_appconfig_id" {
  value       = azurerm_app_configuration.appconfig.id
}

output "security_keyvault_id" {
  value       = azurerm_key_vault.keyvault.id
}

output "security_mi_id" {
  value       = azurerm_user_assigned_identity.managed-identity.id
}

output "security_appGwCert_id" {
  value       = data.azurerm_key_vault_secret.appGwCert.versionless_id
}

output "security_keyvault_name" {
  value       = azurerm_key_vault.keyvault.name
}

output "security_appconfig_name" {
  value       = azurerm_app_configuration.appconfig.name
}

output "security_keyvault_uri" {
  value       = azurerm_key_vault.keyvault.vault_uri
}

output "security_appconfig_endpoint" {
  value       = azurerm_app_configuration.appconfig.endpoint
}

output "security_keyvault_webkey_name" {
  value       = azurerm_key_vault_secret.web-key.name
}

output "security_appconfig_tenantId_key" {
  value       = azurerm_app_configuration_key.appconfig-tenantId.key
}

output "security_appconfig_apiClientId_key" {
  value       = azurerm_app_configuration_key.appconfig-apiClientId.key
}

output "security_appconfig_webClientId_key" {
  value       = azurerm_app_configuration_key.appconfig-webClientId.key
}

output "security_appconfig_JwtClockSkew_key" {
  value       = azurerm_app_configuration_key.appconfig-JwtClockSkew.key
}

output "security_appconfig_tenantId_label" {
  value       = azurerm_app_configuration_key.appconfig-tenantId.label
}

output "security_appconfig_apiClientId_label" {
  value       = azurerm_app_configuration_key.appconfig-apiClientId.label
}

output "security_appconfig_webClientId_label" {
  value       = azurerm_app_configuration_key.appconfig-webClientId.label
}

output "security_appconfig_JwtClockSkew_label" {
  value       = azurerm_app_configuration_key.appconfig-JwtClockSkew.label
}