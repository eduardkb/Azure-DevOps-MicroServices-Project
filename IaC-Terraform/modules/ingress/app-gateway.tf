# APP GW PUBLIC IP
resource "azurerm_public_ip" "appgw_pip" {
  name                = lower("${var.project_initials}${var.random_suffix}-appfe-AppGwPIP")  
  location            = var.location
  resource_group_name = var.deploy_rg
  allocation_method   = "Static"
  sku                 = "Standard"
  tags = var.shared_tags
}

# APP GATEWAY
resource "azurerm_application_gateway" "appgw" {
  name                = lower("${var.project_initials}${var.random_suffix}-appfe-AppGateway")
  location            = var.location
  resource_group_name = var.deploy_rg
  sku {
    name     = "Basic" #Standard_v2
    tier     = "Basic" #Standard_v2
    capacity = 1
  }
  identity {
    type = "UserAssigned"
    identity_ids = [var.security_mi_id]    
  }
  ssl_certificate {
    name                = "app-ssl-cert"
    key_vault_secret_id = var.security_appGwCert_id
  }
  gateway_ip_configuration {
    name      = "appgw-ip-config"
    subnet_id = var.network_gw_subnet_id
  }

  frontend_port {
    name = "frontendPort"
    port = 443
  }

  frontend_ip_configuration {
    name                 = "appgw-frontend-ip"
    public_ip_address_id = azurerm_public_ip.appgw_pip.id
  }

  backend_address_pool {
    name = "appgw-backend-pool-swa"
    fqdns = [var.compute_static-wa_host-name]
  }  

  backend_address_pool {
    name = "appgw-backend-pool-fa"
    fqdns = [var.compute_static-fa_host-name]
  }

  backend_http_settings {
    name                  = "appgw-https-settings-swa"
    cookie_based_affinity = "Disabled"
    port                  = 443
    protocol              = "Https"
    request_timeout       = 30
    probe_name            = "ProbeHttpsSwa"
    pick_host_name_from_backend_address = false
    host_name = var.compute_static-wa_host-name
  }

  backend_http_settings {
    name                  = "appgw-https-settings-fa"
    cookie_based_affinity = "Disabled"
    port                  = 443
    protocol              = "Https"
    request_timeout       = 30
    probe_name            = "ProbeHttpsFa"
    pick_host_name_from_backend_address = false
    host_name = var.compute_static-fa_host-name
  }

  http_listener {
    name                           = "appgw-listener"
    frontend_ip_configuration_name = "appgw-frontend-ip"
    frontend_port_name             = "frontendPort"
    protocol                       = "Https"
    ssl_certificate_name           = "app-ssl-cert"
    host_name                      = trimsuffix(azurerm_dns_a_record.appgw_dns.fqdn, ".")
  }
  
  # URL path map: default to Static Web App; /api/* to Function App
  url_path_map {
    name                           = "appgw-url-path-map"
    default_backend_address_pool_name  = "appgw-backend-pool-swa"        # SWA
    default_backend_http_settings_name = "appgw-https-settings-swa"      # SWA settings

    path_rule {
      name                           = "api-path"
      paths                          = ["/api/*"]
      backend_address_pool_name      = "appgw-backend-pool-fa"        # NEW: Function App pool
      backend_http_settings_name     = "appgw-https-settings-fa"      # NEW: Function App settings
    }
  }

  request_routing_rule {
    name                       = "appgw-routing-rule1"
    rule_type                  = "PathBasedRouting"
    http_listener_name         = "appgw-listener"
    url_path_map_name          = "appgw-url-path-map"
    priority                   = 100
  }

  probe {
    name                = "ProbeHttpsSwa"
    protocol            = "Https"
    path                = "/"
    port                = 443
    interval            = 3600 # DEFAULT INTERVAL FOR HEALTHCHECK = 30
    timeout             = 30
    unhealthy_threshold = 3
    pick_host_name_from_backend_http_settings = true
    match {
      body              = ""
      status_code      = ["200-399"]
    }
  }
  
  probe {
    name                = "ProbeHttpsFa"
    protocol            = "Https"
    path                = "/api/healthcheck"
    port                = 443
    interval            = 3600 # DEFAULT INTERVAL FOR HEALTHCHECK = 30
    timeout             = 30
    unhealthy_threshold = 3
    pick_host_name_from_backend_http_settings = true
    match {
      body              = ""
      status_code      = ["200-399"]
    }
  }

  // depends_on = [azurerm_public_ip.appgw_pip, azurerm_role_assignment.app_gateway_secret_reader]
  tags = var.shared_tags
}