# Careerjet: proxy con IP fija (gratis)

Careerjet solo responde desde IPs declaradas en su panel (Access API > Server IP addresses) y Vercel cambia de IP. Solución: un servidor
mínimo con IP fija reenvía la búsqueda. La app lo usa si existe `CAREERJET_PROXY_URL`; si no, llama directo (sirve en tu PC con tu IP declarada).

## 1. La VM gratis (Oracle Cloud "Always Free")
1. Cuenta en cloud.oracle.com (pide tarjeta solo para verificar; el nivel Always Free no se cobra).
2. Crear una instancia Ubuntu (forma `VM.Standard.E2.1.Micro` o Ampere A1), con **IP pública reservada** (Networking > Reserved public IPs).
3. En la lista de seguridad de la VCN, abrir el puerto 8080 (TCP, entrada) y en la VM: `sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT`.

## 2. El proxy en la VM
```
sudo apt update && sudo apt install -y nodejs
# copiar scripts/careerjet-proxy.mjs a la VM, luego:
PROXY_SECRET='<un secreto largo al azar>' node careerjet-proxy.mjs
```
Para que quede siempre encendido: `sudo npm i -g pm2 && PROXY_SECRET=... pm2 start careerjet-proxy.mjs && pm2 save && pm2 startup`.
Comprobar: `curl http://<IP>:8080/health` responde `ok`.

## 3. Careerjet y Vercel
- En el panel de Careerjet, declarar la **IP de la VM** (hasta 8 IPs; puede quedar también la de tu PC para probar).
- En Vercel (Settings > Environment Variables): `CAREERJET_API_KEY`, `CAREERJET_PROXY_URL=http://<IP>:8080`, `CAREERJET_PROXY_SECRET=<el mismo secreto>`.
- El tráfico va por HTTP simple: lleva la clave de Careerjet. Para cifrarlo, poner un dominio con Caddy (HTTPS automático) delante del proxy.
