# IMPORT EXISTING DNS ZONE
data "azurerm_dns_zone" "imported_dns_zone" {
  name                = var.imported_dns_zone_name
  resource_group_name = var.imported_resource_group
}

# DNS A RECORD FOR APP GATEWAY
resource "azurerm_dns_a_record" "appgw_dns" {
  name                = var.dns_zone_prefix
  zone_name           = data.azurerm_dns_zone.imported_dns_zone.name    
  resource_group_name = data.azurerm_dns_zone.imported_dns_zone.resource_group_name
  ttl                 = 60
  records             = [azurerm_public_ip.appgw_pip.ip_address]
}
