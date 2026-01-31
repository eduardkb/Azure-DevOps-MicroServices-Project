#-------------------------------
# FUNCTION APP SERVICE PLAN
#-------------------------------

resource "azurerm_service_plan" "function-sp" {
  name                = lower("${var.project_initials}${var.random_suffix}-appbe-sp")
  resource_group_name = var.deploy_rg
  location            = var.location
  sku_name            = "FC1"
  os_type             = "Linux"
}

#-------------------------------
# FUNCTION APP
#-------------------------------

resource "azurerm_function_app_flex_consumption" "function" {
  name                = lower("${var.project_initials}${var.random_suffix}-appbe-fa")
  resource_group_name = var.deploy_rg
  location            = var.location
  service_plan_id     = azurerm_service_plan.function-sp.id

  
  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${var.storage_blob_endpoint}${var.storage_container_function}"  
  storage_authentication_type = "StorageAccountConnectionString"
  storage_access_key          = var.storage_access_key
  runtime_name                = "node"
  runtime_version             = "20"
  maximum_instance_count      = 50
  instance_memory_in_mb       = 2048
  public_network_access_enabled = false
  virtual_network_subnet_id = var.network_integ_subnet_id  

#  identity {
#    type         = "SystemAssigned" 
#  }
  
  app_settings = {
    "FUNCTIONS_EXTENSION_VERSION"           = "~4"
    "AZURE_STORAGE_ACCOUNT_URL"             = var.storage_blob_endpoint                    
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = var.appinsights_conn_string
    "APPINSIGHTS_INSTRUMENTATIONKEY"        = var.appinsights_instrument_key
    "AZURE_APPCONFIG_ENDPOINT"              = var.security_appconfig_endpoint
    "AZURE_KEYVAULT_ENDPOINT"               = var.security_keyvault_uri
    "AZURE_SERVICE_BUS_CONN_STRING"         = var.storage_servicebus_conn_string
    "AZURE_JWT_TENANT_ID"                   = "@Microsoft.AppConfiguration(Endpoint=https://${var.security_appconfig_name}.azconfig.io; Key=${var.security_appconfig_tenantId_key}; Label=${var.security_appconfig_tenantId_label})"
    "AZURE_JWT_EXPECTED_AUD"                = "@Microsoft.AppConfiguration(Endpoint=https://${var.security_appconfig_name}.azconfig.io; Key=${var.security_appconfig_apiClientId_key}; Label=${var.security_appconfig_apiClientId_label})"
    "AZURE_JWT_WEB_CLIENTID"                = "@Microsoft.AppConfiguration(Endpoint=https://${var.security_appconfig_name}.azconfig.io; Key=${var.security_appconfig_webClientId_key}; Label=${var.security_appconfig_webClientId_label})"
    "AZURE_JWT_JWT_CLOCK_SKEW_SEC"          = "@Microsoft.AppConfiguration(Endpoint=https://${var.security_appconfig_name}.azconfig.io; Key=${var.security_appconfig_JwtClockSkew_key}; Label=${var.security_appconfig_JwtClockSkew_label})"
    "WEB_KEY"                               = "@Microsoft.KeyVault(SecretUri=https://${var.security_keyvault_name}.vault.azure.net/secrets/${var.security_keyvault_webkey_name})"
  }
  
  site_config {
    cors {
      allowed_origins = [
        "https://portal.azure.com",
        "http://localhost:3000"
      ]
      support_credentials = true
    }
    minimum_tls_version = "1.2"
    vnet_route_all_enabled = true
  }
  tags = var.shared_tags
}