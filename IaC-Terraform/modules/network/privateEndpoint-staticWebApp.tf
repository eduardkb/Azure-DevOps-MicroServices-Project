resource "azurerm_private_endpoint" "staticwa_pe" {
  name                = lower("${var.project_initials}${var.random_suffix}-net-staticwa-pe")
  location            = var.location
  resource_group_name = var.deploy_rg
  subnet_id           = data.azapi_resource.serv_subnet.id
  custom_network_interface_name = lower("${var.project_initials}${var.random_suffix}-net-staticwa-pe-nic")

  private_service_connection {
    name                           = "staticwa-psc"
    private_connection_resource_id = var.compute_static-wa_id
    subresource_names              = ["staticSites"] 
    is_manual_connection           = false
  }
  private_dns_zone_group {
    name                 = "staticwa-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.staticwa_dns.id]
  }
}

resource "azurerm_private_dns_zone" "staticwa_dns" {
  name                = local.private_dns_zone
  resource_group_name = var.deploy_rg
}

resource "azurerm_private_dns_zone_virtual_network_link" "staticwa_dns_link" {
  name                  = "staticwa-dnslink"
  resource_group_name   = var.deploy_rg
  private_dns_zone_name = azurerm_private_dns_zone.staticwa_dns.name
  virtual_network_id    = azapi_resource.vnet.id
}

# extract partition id from azure static web app to use on azurerm_private_dns_zone
locals {
  default_hostname = var.compute_static-wa_host-name 
  # If the hostname has a numeric label before azurestaticapps.net, capture it.
  # Returns ["<partitionId>"] when matched; null when not.
  partition_match  = regex("^.+\\.(\\d+)\\.azurestaticapps\\.net$", local.default_hostname)

  partition_id     = local.partition_match != null ? local.partition_match[0] : ""
  private_dns_zone = local.partition_id != "" ? "privatelink.${local.partition_id}.azurestaticapps.net" : "privatelink.azurestaticapps.net"
}