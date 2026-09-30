# García Herreros FC · App administrativa

Primera versión independiente del prototipo de ChatGPT. Es una aplicación web estática lista para GitHub Pages.

## Incluye

- Panel administrativo.
- Fichas de deportistas.
- Estado de mensualidad por jugador.
- Registro de pagos y abonos.
- Historial de movimientos.
- Comprobante PDF institucional.
- Diseño responsive para computador y celular.
- Datos guardados temporalmente en `localStorage` del navegador.
- Estructura preparada para conectar Supabase en la siguiente fase.

## Probar localmente

Puedes abrir `index.html` directamente en el navegador. Para una experiencia más estable, usa la extensión Live Server de Visual Studio Code.

## Publicar gratis en GitHub Pages

1. Sube todos estos archivos al repositorio `garcia-herreros-app`.
2. En GitHub entra a **Settings > Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda los cambios.

## Siguiente fase

Conectar Supabase para:

- Inicio de sesión con usuarios y contraseñas reales.
- Roles de administrador, entrenador y consulta.
- Base de datos permanente en la nube.
- Fichas y pagos disponibles desde cualquier dispositivo.
- Copias de seguridad y trazabilidad.

## Importante

Los deportistas y números incluidos en esta primera versión son datos de demostración para probar la interfaz. Antes de uso real deben cargarse los registros definitivos del club.
