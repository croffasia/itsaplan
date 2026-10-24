#!/bin/sh
set -eu

# Docker's published ports bypass UFW's INPUT rules. Filter public ingress first.
iptables-restore --wait 5 --noflush <<'RULES'
*filter
:ITSAPLAN-INGRESS - [0:0]
-F ITSAPLAN-INGRESS
-A ITSAPLAN-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
-A ITSAPLAN-INGRESS -p tcp --dport 80 -m conntrack --ctorigdst 169.58.123.186 --ctorigdstport 80 -j RETURN
-A ITSAPLAN-INGRESS -p tcp --dport 443 -m conntrack --ctorigdst 169.58.123.186 --ctorigdstport 443 -j RETURN
-A ITSAPLAN-INGRESS -j DROP
COMMIT
RULES

ip6tables-restore --wait 5 --noflush <<'RULES'
*filter
:ITSAPLAN-INGRESS - [0:0]
-F ITSAPLAN-INGRESS
-A ITSAPLAN-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
-A ITSAPLAN-INGRESS -j DROP
COMMIT
RULES

for firewall in iptables ip6tables; do
    for bridge in 'br+' docker0; do
        if ! "$firewall" -w 5 -C DOCKER-USER -i eth0 -o "$bridge" -j ITSAPLAN-INGRESS 2>/dev/null; then
            "$firewall" -w 5 -I DOCKER-USER 1 -i eth0 -o "$bridge" -j ITSAPLAN-INGRESS
        fi
    done
done
