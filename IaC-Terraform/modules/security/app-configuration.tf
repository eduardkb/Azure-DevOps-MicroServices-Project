resource "azurerm_app_configuration" "appconfig" {
  name                = lower("${var.project_initials}${var.random_suffix}-sec-appconfig")
  resource_group_name = var.deploy_rg
  location            = var.location
  sku                 = "standard"
  public_network_access = "Enabled"
  tags = var.shared_tags
}

# CREATE KEYS ON APP CONFIGURATION
resource "azurerm_app_configuration_key" "appconfig-webClientId" {
  configuration_store_id = azurerm_app_configuration.appconfig.id
  key = "webClientId"
  label = "prod"  
  type = "kv"
  value = "${var.AppReg_WebClientID}"  
  depends_on = [ azurerm_role_assignment.appconf-dataowner ]
}

resource "azurerm_app_configuration_key" "appconfig-apiClientId" {
  configuration_store_id = azurerm_app_configuration.appconfig.id
  key = "apiClientID"
  label = "prod"  
  type = "kv"
  value = "${var.AppReg_ApiClientID}"    
  depends_on = [ azurerm_role_assignment.appconf-dataowner ]
}

resource "azurerm_app_configuration_key" "appconfig-tenantId" {
  configuration_store_id = azurerm_app_configuration.appconfig.id
  key = "tenantId"
  label = "prod"
  type = "kv"
  value = var.client_config_tenant_id
  depends_on = [ azurerm_role_assignment.appconf-dataowner ]
}

resource "azurerm_app_configuration_key" "appconfig-JwtClockSkew" {
  configuration_store_id = azurerm_app_configuration.appconfig.id
  key = "JwtClockSkew"
  label = "prod"
  type = "kv"
  value = 120
  depends_on = [ azurerm_role_assignment.appconf-dataowner ]
}