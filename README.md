# QuizFiesta — prototipo multijugador

Aplicación web responsive para concursos dirigidos por un presentador. Los jugadores entran desde su móvil con un código y el estado de la sala se sincroniza mediante Supabase Realtime.

## Incluye en esta primera versión

- Crear sala con código y enlace para compartir.
- Acceso de jugadores desde móvil.
- Selección de nombre y avatar.
- Preguntas de opción múltiple.
- Temporizador sincronizado desde el inicio de la pregunta.
- El presentador lanza y cierra cada pregunta.
- Puntuación: 500 puntos por acertar + hasta 500 de bonus por rapidez.
- Clasificación después de cada pregunta y podio final.
- Cuatro preguntas de ejemplo para probar el flujo.
- Editor de concursos: crea preguntas, cuatro opciones, marca la correcta y define el tiempo.
- Guarda concursos en el almacenamiento local del dispositivo y selecciona uno para jugar.

## Requisitos

- Node.js 20 o superior.
- Un proyecto Supabase (el plan gratuito sirve para pruebas).

## Configuración

1. Crea un proyecto en https://supabase.com/.
2. Abre **SQL Editor** en Supabase y ejecuta el contenido de `supabase/schema.sql`.
3. En **Project Settings → API**, copia Project URL y la clave `anon`/publishable.
4. Copia `.env.example` a `.env` y rellena:

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
   ```

5. Instala y arranca:

   ```bash
   npm install
   npm run dev
   ```

6. Abre la URL local que indique Vite. Para probar con varios móviles, despliega la app en un hosting HTTPS (por ejemplo Vercel o Netlify) y comparte el enlace.

## Flujo de uso

- Presentador: abre la web y pulsa **Crear partida**.
- Jugadores: abren el enlace o escriben el código, su nombre y eligen avatar.
- Presentador: pulsa **Comenzar concurso**, cierra cada pregunta y avanza.
- Jugadores: responden desde sus móviles y ven el resultado al cerrar la pregunta.

## Importante: estado del prototipo

Esta es una base funcional para validar el flujo de juego, no una versión lista para producción. El esquema SQL incluye políticas abiertas para facilitar una prueba privada; no publiques una partida abierta a internet con estas políticas. Antes de un lanzamiento real hay que añadir identidad/autorización de anfitrión y jugadores, validar respuestas y calcular puntos en el servidor, ocultar las respuestas correctas hasta el cierre, limitar abuso y añadir herramientas para crear/editar/importar preguntas. La interfaz incluye preguntas de demostración y un editor de concursos. Los concursos creados se guardan localmente en el navegador donde se crearon; todavía no se sincronizan entre dispositivos ni se almacenan en una cuenta.

La clave `service_role` de Supabase nunca debe ponerse en el frontend.
