# WHAT: Read Certificate from Key Vault
# WHY: App Gateway needs access to read SSL certificate from imported Keyvault 
resource "azurerm_role_assignment" "app_gateway_secret_reader" {
  scope                = data.azurerm_key_vault.importedKv.id
  role_definition_name = "Key Vault Certificates User"
  principal_id         = azurerm_user_assigned_identity.managed-identity.principal_id
}
