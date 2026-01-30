resource "azurerm_private_endpoint" "appconfig_pe" {
  name                = lower("${var.project_initials}${var.random_suffix}-net-appconfig-pe")
  location            = var.location
  resource_group_name = var.deploy_rg
  subnet_id           = data.azapi_resource.serv_subnet.id
  custom_network_interface_name = lower("${var.project_initials}${var.random_suffix}-net-appconfig-pe-nic")

  private_service_connection {
    name                           = "appconfig-psc"
    private_connection_resource_id = var.security_appconfig_id
    subresource_names              = ["configurationStores"] 
    is_manual_connection           = false
  }
  private_dns_zone_group {
    name                 = "appconfig-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.appconfig_dns.id]
  }
}

resource "azurerm_private_dns_zone" "appconfig_dns" {
  name                = "privatelink.azconfig.io"
  resource_group_name = var.deploy_rg
}

resource "azurerm_private_dns_zone_virtual_network_link" "appconfig_dns_link" {
  name                  = "cosmosdb-dnslink"
  resource_group_name   = var.deploy_rg
  private_dns_zone_name = azurerm_private_dns_zone.appconfig_dns.name
  virtual_network_id    = azapi_resource.vnet.id
}