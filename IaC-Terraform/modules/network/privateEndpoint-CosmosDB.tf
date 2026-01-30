resource "azurerm_private_endpoint" "cosmosdb_pe" {
  name                = lower("${var.project_initials}${var.random_suffix}-net-cosmosdb-pe")
  location            = var.location
  resource_group_name = var.deploy_rg
  subnet_id           = data.azapi_resource.serv_subnet.id
  custom_network_interface_name = lower("${var.project_initials}${var.random_suffix}-net-cosmosdb-pe-nic")

  private_service_connection {
    name                           = "cosmosdb-psc"
    private_connection_resource_id = var.db_cosmosdb_id
    subresource_names              = ["MongoDB"] # For MongoDB API
    is_manual_connection           = false
  }    
  private_dns_zone_group {    
    name                 = "cosmosdb-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.cosmosdb_dns.id]
  }
}


resource "azurerm_private_dns_zone" "cosmosdb_dns" {
  name                = "privatelink.mongo.cosmos.azure.com"
  resource_group_name = var.deploy_rg
}

resource "azurerm_private_dns_zone_virtual_network_link" "cosmosdb_dns_link" {
  name                  = "cosmosdb-dnslink"
  resource_group_name   = var.deploy_rg
  private_dns_zone_name = azurerm_private_dns_zone.cosmosdb_dns.name
  virtual_network_id    = azapi_resource.vnet.id
}