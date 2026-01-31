
module "global" {
  source = "../../global"
  # Optionally override defaults:
  # project_initials = "ekb"
  # location         = "centralus"
  # shared_tags      = { owner = "Eduard Keller Buhali", reason = "Study - Full Microservices Project" }
}

module "network" {
  source = "../../modules/network"
  
  project_initials                = module.global.project_initials
  random_suffix                   = module.global.random_suffix
  deploy_rg                       = module.global.deploy_rg
  location                        = module.global.location
  shared_tags                     = module.global.shared_tags
  client_config_subscription_id   = module.global.client_config_subscription_id

  compute_function_id             = module.compute.compute_function_id
  compute_static-wa_id            = module.compute.compute_static-wa_id
  compute_static-wa_host-name     = module.compute.compute_static-wa_host-name
  db_cosmosdb_id                  = module.data.db_cosmosdb_id
  security_appconfig_id           = module.security.security_appconfig_id
  security_keyvault_id            = module.security.security_keyvault_id
}

module "compute" {
  source = "../../modules/compute"

  project_initials                        = module.global.project_initials
  random_suffix                           = module.global.random_suffix
  deploy_rg                               = module.global.deploy_rg
  location                                = module.global.location
  shared_tags                             = module.global.shared_tags  

  storage_access_key                      = module.data.storage_access_key
  storage_blob_endpoint                   = module.data.storage_blob_endpoint
  storage_container_function              = module.data.storage_container_function
  storage_servicebus_conn_string          = module.data.storage_servicebus_conn_string
  network_integ_subnet_id                 = module.network.network_integ_subnet_id
  appinsights_conn_string                 = module.monitoring.appinsights_conn_string
  appinsights_instrument_key              = module.monitoring.appinsights_conn_string 
  security_keyvault_name                  = module.security.security_keyvault_name 
  security_keyvault_uri                   = module.security.security_keyvault_uri
  security_appconfig_endpoint             = module.security.security_appconfig_endpoint
  security_appconfig_name                 = module.security.security_appconfig_name 
  security_keyvault_webkey_name           = module.security.security_keyvault_webkey_name
  security_appconfig_apiClientId_key      = module.security.security_appconfig_apiClientId_key
  security_appconfig_JwtClockSkew_key     = module.security.security_appconfig_JwtClockSkew_key
  security_appconfig_tenantId_key         = module.security.security_appconfig_tenantId_key
  security_appconfig_webClientId_key      = module.security.security_appconfig_webClientId_key
  security_appconfig_apiClientId_label    = module.security.security_appconfig_apiClientId_label
  security_appconfig_JwtClockSkew_label   = module.security.security_appconfig_JwtClockSkew_label
  security_appconfig_tenantId_label       = module.security.security_appconfig_tenantId_label
  security_appconfig_webClientId_label    = module.security.security_appconfig_webClientId_label

}

module "data" {
  source = "../../modules/data"
  
  project_initials = module.global.project_initials
  random_suffix    = module.global.random_suffix
  deploy_rg        = module.global.deploy_rg
  location         = module.global.location
  shared_tags      = module.global.shared_tags  
}

module "ingress" {
  source = "../../modules/ingress"

  project_initials              = module.global.project_initials
  random_suffix                 = module.global.random_suffix
  deploy_rg                     = module.global.deploy_rg
  location                      = module.global.location
  shared_tags                   = module.global.shared_tags  

  security_mi_id                = module.security.security_mi_id
  security_appGwCert_id         = module.security.security_appGwCert_id
  network_gw_subnet_id          = module.network.network_gw_subnet_id
  compute_static-wa_host-name   = module.compute.compute_static-wa_host-name
  compute_static-fa_host-name   = module.compute.compute_static-fa_host-name
}

module "security" {
  source = "../../modules/security"
  
  project_initials          = module.global.project_initials
  random_suffix             = module.global.random_suffix
  deploy_rg                 = module.global.deploy_rg
  location                  = module.global.location
  shared_tags               = module.global.shared_tags  
  client_config_tenant_id   = module.global.client_config_tenant_id
  client_config_object_id   = module.global.client_config_object_id
  random_web_key            = module.global.random_web_key

  #compute_function_identity = module.compute.compute_function_identity
  storage_id                = module.data.storage_id
  storage_servicebus_id     = module.data.storage_servicebus_id  
  db_cosmosdb_conn_string   = module.data.db_cosmosdb_conn_string
  storage_access_key        = module.data.storage_access_key
}

module "monitoring" {
  source = "../../modules/monitoring"

  project_initials = module.global.project_initials
  random_suffix    = module.global.random_suffix
  deploy_rg        = module.global.deploy_rg
  location         = module.global.location
  shared_tags      = module.global.shared_tags  
}