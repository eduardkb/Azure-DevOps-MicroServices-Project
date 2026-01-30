resource "azurerm_private_endpoint" "function_pe" {
  name                = lower("${var.project_initials}${var.random_suffix}-net-function-pe")
  location            = var.location
  resource_group_name = var.deploy_rg
  subnet_id           = data.azapi_resource.serv_subnet.id
  custom_network_interface_name = lower("${var.project_initials}${var.random_suffix}-net-function-pe-nic")

  private_service_connection {
    name                           = "function-psc"
    private_connection_resource_id = var.compute_function_id
    subresource_names              = ["sites"] 
    is_manual_connection           = false
  }
  private_dns_zone_group {    
    name                 = "function-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.function_dns.id]
  }
}

resource "azurerm_private_dns_zone" "function_dns" {
  name                = "privatelink.azurewebsites.net"
  resource_group_name = var.deploy_rg
}

resource "azurerm_private_dns_zone_virtual_network_link" "function_dns_link" {
  name                  = "function-dnslink"
  resource_group_name   = var.deploy_rg
  private_dns_zone_name = azurerm_private_dns_zone.function_dns.name
  virtual_network_id    = azapi_resource.vnet.id
}