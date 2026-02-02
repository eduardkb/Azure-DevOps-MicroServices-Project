# WHAT: Give access to function app to the resouces it needs access to
# WHY: Function App needs access to read keyvault secrets, read app configuration
#       keys, write to storage account to save patient files and write to
#       the service bus queue.

resource "azurerm_role_assignment" "function_kv_secret_reader" {
  scope                = azurerm_key_vault.keyvault.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.compute_function_identity
}

resource "azurerm_role_assignment" "function_appConfig_read" {
  scope                 = azurerm_app_configuration.appconfig.id
  role_definition_name  = "App Configuration Data Reader"
  principal_id         = var.compute_function_identity
}

resource "azurerm_role_assignment" "function_storage_write" {
  scope                = var.storage_id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = var.compute_function_identity
}

resource "azurerm_role_assignment" "function_servicebus-owner" {
  scope                 = var.storage_servicebus_id
  role_definition_name  = "Azure Service Bus Data Owner"
  principal_id          = var.compute_function_identity
}