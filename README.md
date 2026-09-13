# Simulador de Test · Oposiciones Trabajo Social · Mairena del Aljarafe

Versión 1.0

Aplicación web estática (HTML + CSS + JavaScript ES Modules) preparada para GitHub Pages.

## Funciones

- Test personalizado por número de preguntas y temas.
- Selección rápida de materias comunes, específicas o todo el temario.
- Distribución equilibrada de preguntas entre los temas elegidos.
- Barajado de preguntas y de las tres respuestas.
- Simulacro oficial: 100 preguntas / 120 minutos.
- Puntuación normalizada sobre 10:
  - acierto: +1 unidad neta
  - error: -1/3 de unidad neta
  - blanco: 0
- Revisión de respuestas incorrectas y en blanco.
- Historial en `localStorage`.
- Estadísticas globales y por tema.
- Guardado automático del test en curso.
- Recuperación del test tras cerrar o recargar la página.
- En simulacro oficial, el cronómetro sigue corriendo aunque se cierre la pestaña.

## Banco de preguntas

Cada tema usa:

`data/tema-XX.json`

Formato:

```json
{
  "tema": 1,
  "titulo": "Constitución Española de 1978",
  "preguntas": [
    {
      "id": "T01-P001",
      "pregunta": "Texto de la pregunta",
      "opciones": [
        "Opción A",
        "Opción B",
        "Opción C"
      ],
      "correcta": 0
    }
  ]
}
```

`correcta` es el índice 0, 1 o 2 de la opción correcta. La aplicación baraja automáticamente las opciones.

## Importante sobre los datos de v1.0

La versión 1.0 incluye:

- Los 60 temas del temario configurados.
- Varias preguntas funcionales de ejemplo en el Tema 1.
- Una pregunta explícitamente marcada como **PREGUNTA DE DEMOSTRACIÓN** en cada uno de los temas 2-60.

Estas preguntas de demostración existen sólo para mostrar y validar el formato JSON. Deben sustituirse por el banco real de preguntas.

## Ejecución local

Por el uso de `fetch()` y módulos ES, no conviene abrir `index.html` directamente mediante `file://`.

Ejemplo con Python:

```bash
python3 -m http.server 8000
```

Después:

`http://localhost:8000`

## GitHub Pages

1. Subir todos los archivos a un repositorio.
2. Ir a Settings → Pages.
3. Elegir la rama de publicación (por ejemplo `main`) y `/ (root)`.
4. Guardar.
5. GitHub Pages publicará la aplicación.

## Privacidad

El historial y los tests en curso se guardan únicamente en el `localStorage` del navegador. No se envía información a ningún servidor.
