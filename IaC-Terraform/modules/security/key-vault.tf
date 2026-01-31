resource "azurerm_key_vault" "keyvault" {
  name                        = lower("${var.project_initials}${var.random_suffix}-sec-kv")
  location                    = var.location
  resource_group_name         = var.deploy_rg
  enabled_for_disk_encryption = true
  tenant_id                   = var.client_config_tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  rbac_authorization_enabled  = true 
  public_network_access_enabled = true
  sku_name = "standard"
  tags = var.shared_tags
}

// IMPORT EXISTING KEY VAULT TO IMPORT PRE-EXISTING SECRETS
data "azurerm_key_vault" "importedKv" {
  name                = var.imported_keyvault
  resource_group_name = var.imported_resource_group
}

data "azurerm_key_vault_secret" "appGwCert" {
  name         = "appGateway-sslPfxCert"
  key_vault_id = data.azurerm_key_vault.importedKv.id
  depends_on = [ azurerm_role_assignment.app_gateway_secret_reader ]
}

// CREATE SECRETS ON NEW KEY VAULT
resource "azurerm_key_vault_secret" "kv-cosmos-connstr" {
  name          = "CosmosDb-ConStr"
  key_vault_id  = azurerm_key_vault.keyvault.id
  value         = var.db_cosmosdb_conn_string
  content_type  = "text/plain"
  depends_on = [ azurerm_role_assignment.kv-secrets-officer ]
}

resource "azurerm_key_vault_secret" "storage-key" {
  name          = "storage-key"
  key_vault_id  = azurerm_key_vault.keyvault.id
  value         = var.storage_access_key
  content_type  = "text/plain"
  depends_on = [ azurerm_role_assignment.kv-secrets-officer ]  
}

resource "azurerm_key_vault_secret" "web-key" {
  name          = "web-key"
  key_vault_id  = azurerm_key_vault.keyvault.id
  value         = var.random_web_key
  content_type  = "text/plain"
  depends_on = [ azurerm_role_assignment.kv-secrets-officer ]  
}