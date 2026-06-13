**🚀 Contenedor WhatsApp-Web.js**  
Servicio de WhatsApp-Web.js en Docker con API REST y sesiones persistentes. Incluye autorecuperación de sesión en caso de reinicio o apagado del contenedor.  
**📦 Instalación**  
1. **Clonar el repositorio**  
2. git clone https://github.com/tuusuario/whatsapp-service.git  
 cd whatsapp-service  
   
3. **Entrar en carpeta de aplicación**  
4. cd datos/app  
   
5. **Instalar dependencias**  
6. npm install  
   
7. **Levantar el contenedor**  
8. docker-compose up -d --build  
   
El servicio quedará disponible en http://localhost:3000.  
**⚙️ Docker Compose**  
services:  
  whatsapp:  
     build: .  
     container_name: whatsapp-service  
     user: node  
     working_dir: /app  
     command: bash -c "npm start"  
     restart: unless-stopped  
     deploy:  
       resources:  
         limits:  
           cpus: '1.0'  
           memory: 2G  
         reservations:  
           memory: 512M  
     ports:  
       - 3000:3000  
     volumes:  
       - ../datos/app:/app  
       - ../datos/app/logs:/app/logs  
       - ../datos/app/session:/app/session  
     networks:  
       - infra_net  
 networks:  
   infra_net:  
     external: true  
   
**🛠️ Dockerfile**  
FROM node:18-slim  
   
 RUN apt-get update && apt-get install -y \  
     chromium \  
     fonts-liberation \  
     libnss3 \  
     libxss1 \  
     libasound2 \  
     && rm -rf /var/lib/apt/lists/*  
   
 WORKDIR /app  
   
 EXPOSE 3000  
   
**📚 Librerías utilizadas**  
- **express** → Servidor web y endpoints REST.  
- **whatsapp-web.js** → Cliente de WhatsApp Web.  
- **qrcode-terminal** → Muestra QR en consola.  
- **qrcode** → Genera QR en formato imagen.  
- **fs / path** → Manejo de archivos y rutas.  
- **child_process (exec)** → Limpieza de locks de Chromium.  
**🔄 Autorecuperación de sesión**  
El contenedor implementa lógica de **autosanación**:  
- Al iniciar, si existe carpeta ./ww-session con datos, intenta reconectar automáticamente.  
- Si se detectan **locks de Chromium** (SingletonLock, SingletonCookie), se eliminan antes de inicializar.  
- Si ocurre **auth_failure**, se borra la sesión corrupta y se reinicia el flujo de login.  
- Si el cliente se **desconecta**, se destruye y queda listo para reinicializar.  
- El volumen ../datos/app/session asegura persistencia entre reinicios del contenedor.  
**🌐 Endpoints principales**  
- / → Estado visual del servicio.  
- /login → Vinculación con QR dinámico.  
- /status → Estado JSON detallado.  
- /qr-image → Último QR en PNG.  
- /status-check → Estado rápido de conexión.  
- /chats → Lista de chats activos.  
- /contacts → Lista de contactos.  
- /send?number=...&message=... → Enviar mensaje.  
- /logout → Cerrar sesión y destruir cliente.  
**🧪 Ejemplos de uso con curl**  
# Ver estado  
 curl http://localhost:3000/status  
   
 # Enviar mensaje  
 curl "http://localhost:3000/send?number=595981234567&message=Hola%20desde%20Docker"  
   
 # Cerrar sesión  
 curl http://localhost:3000/logout  
   
**📝 Notas**  
- Revisar logs en ../datos/app/logs.  
- Respaldar carpeta ../datos/app/session para mantener sesiones activas.  
- Monitorear recursos con:  
- docker stats whatsapp-service  
   
**DE MOMENTO NO PIENSO HACER CAMBIOS PORQUE ASÏ ME VA PERFECTO Y HACE LO QUE NECESITO. **  
**SON LIBRES DE AGREGAR MÁS FUNCIONES.**  
