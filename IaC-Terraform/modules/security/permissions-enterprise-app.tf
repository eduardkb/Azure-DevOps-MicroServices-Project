# WHAT: Enterprise application access to create secrets
# WHY: While Github Actions runs with EA permission set, it needs
#       to create secrets in keyvault 
resource "azurerm_role_assignment" "kv-secrets-officer" {
  scope                = azurerm_key_vault.keyvault.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.client_config_object_id
}

# WHAT: Enterprise application access to create keys on app configuration
# WHY: While Github Actions runs with EA permission set, it needs
#       to create keys in app configuration
resource "azurerm_role_assignment" "appconf-dataowner" {
  scope                = azurerm_app_configuration.appconfig.id
  role_definition_name = "App Configuration Data Owner"
  principal_id         = var.client_config_object_id
}