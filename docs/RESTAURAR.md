# Restaurar la base desde un backup

Los backups los genera la acción **Backup de la base** de GitHub todos los días y quedan 14 días
como archivo cifrado (`backup.tar.gz.gpg`) en la ejecución de esa acción.

1. Bajar el archivo desde GitHub > Actions > Backup de la base > la ejecución del día > Artifacts.
2. Descifrar con la frase guardada en el gestor de contraseñas:
   ```sh
   gpg -d backup.tar.gz.gpg | tar xz      # crea la carpeta dump/
   ```
3. Crear un proyecto nuevo de Supabase (o usar uno vacío) y copiar su conexión
   (Connect > Session pooler).
4. Restaurar:
   ```sh
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file dump/roles.sql \
     --file dump/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file dump/data.sql \
     --dbname "CONEXION_DEL_PROYECTO_NUEVO"
   ```
5. Cargar en Vercel la URL y las claves del proyecto nuevo y volver a publicar.
6. Las fotos viven en Supabase Storage y no van en este backup: si se pierde el proyecto,
   hay que volver a subirlas desde el panel.

Guía oficial: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
