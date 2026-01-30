resource "azurerm_private_endpoint" "keyvault_pe" {
  name                = lower("${var.project_initials}${var.random_suffix}-net-keyvault-pe")
  location            = var.location
  resource_group_name = var.deploy_rg
  subnet_id           = data.azapi_resource.serv_subnet.id
  custom_network_interface_name = lower("${var.project_initials}${var.random_suffix}-net-keyvault-pe-nic")

  private_service_connection {
    name                           = "keyvault-psc"
    private_connection_resource_id = var.security_keyvault_id
    subresource_names              = ["vault"] # For MongoDB API
    is_manual_connection           = false
  }
  private_dns_zone_group {    
    name                 = "keyvault-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.keyvault_dns.id]
  }
}

resource "azurerm_private_dns_zone" "keyvault_dns" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = var.deploy_rg
}

resource "azurerm_private_dns_zone_virtual_network_link" "keyvault_dns_link" {
  name                  = "keyvault-dnslink"
  resource_group_name   = var.deploy_rg
  private_dns_zone_name = azurerm_private_dns_zone.keyvault_dns.name
  virtual_network_id    = azapi_resource.vnet.id
}