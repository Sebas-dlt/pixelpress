# Spec Delta

## Purpose

Interfaz de conversión reconstruida sobre el diseño de Lovable (PixelPress):
clara, guiada y honesta sobre lo que está pasando en cada momento.

## ADDED Requirements

### Requirement: Selección de archivo flexible

La zona de conversión aceptará arrastrar y soltar así como selección por clic,
identificando automáticamente si el archivo es PDF o DOCX y orientando al
usuario a la herramienta correcta.

#### Scenario: Arrastrar un PDF
- **WHEN** el usuario suelta un archivo .pdf en la zona de conversión
- **THEN** la app reconoce el tipo y prepara la conversión PDF→Word

#### Scenario: Arrastrar un archivo inválido
- **WHEN** el usuario suelta un archivo de tipo no soportado
- **THEN** la dropzone muestra un mensaje de tipo permitido (PDF y DOCX)

### Requirement: Estados de conversión visibles

La UI mostrará de forma secuencial e identificable: descarga del motor (con
progreso, solo la primera vez), convirtiendo, y resultado con botón de
descarga del archivo convertido.

#### Scenario: Primera conversión
- **WHEN** el usuario convierte por primera vez
- **THEN** ve el progreso de descarga del motor y después el de la conversión

#### Scenario: Conversiones siguientes
- **WHEN** el motor ya está cargado (caché)
- **THEN** la conversión comienza directamente sin volver a descargar el motor

### Requirement: Coherencia con el diseño PixelPress

La landing reproduzca la identidad del diseño de Lovable: paleta OKLCH
(tinta, crema, papel, brand naranja, sun, mint, grape), tipografías Baloo 2 y
Nunito, radio 1rem, y el copy de privacidad (hero, features, stats y FAQ).

#### Scenario: Visita a la landing
- **WHEN** el usuario abre el sitio
- **THEN** ve la estructura del diseño original (nav, hero, convertidor, features, stats, FAQ, footer) con su paleta y tipografía

### Requirement: Accesibilidad básica

Controles interactivos con foco visible, contraste suficiente y etiquetas
accesibles en la dropzone y los botones de conversión/descarga.

#### Scenario: Uso con teclado
- **WHEN** el usuario navega con teclado
- **THEN** puede abrir el selector de archivo, convertir y descargar usando solo Tab/Enter
