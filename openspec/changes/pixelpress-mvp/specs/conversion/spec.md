# Spec Delta

## Purpose

Convertir documentos PDF y Word (DOCX) directamente en el navegador del usuario,
con calidad suficiente para que el resultado sea fiel al original y editable de
verdad.

## ADDED Requirements

### Requirement: Word a PDF fiel al original

El sistema convertirá archivos DOCX a PDF conservando la paginación, los
estilos de texto (negrita, cursiva, tamaño, fuente, color), títulos, listas,
tablas, imágenes y encabezados/pies de página.

#### Scenario: Conversión exitosa de un DOCX complejo
- **WHEN** el usuario selecciona un .docx que contiene títulos, tablas, listas e imágenes
- **THEN** se genera un PDF descargable con el mismo contenido, orden y estilos, con texto seleccionable

#### Scenario: Archivo no soportado
- **WHEN** el usuario selecciona un archivo que no es .docx ni .pdf
- **THEN** se muestra un error claro y no se inicia ninguna conversión

### Requirement: PDF a Word editable

El sistema convertirá archivos PDF con capa de texto a DOCX recuperando
párrafos, tamaños de fuente, negritas/cursivas, alineación, tablas e imágenes
posicionadas, de modo que el documento resultante sea editable en Word.

#### Scenario: Conversión de un PDF con texto
- **WHEN** el usuario selecciona un PDF generado a partir de un documento con texto
- **THEN** se genera un .docx editable cuyo texto y estilos principales coinciden con el original

#### Scenario: PDF escaneado sin capa de texto
- **WHEN** el usuario selecciona un PDF que solo contiene imágenes (sin texto extraíble)
- **THEN** se muestra un aviso explicando que no se puede convertir sin OCR y no se entrega un Word vacío

### Requirement: Conversión sin bloquear la interfaz

Las conversiones correrán en un Web Worker; la interfaz permanecerá
responsiva y mostrará progreso mientras el motor se descarga o convierte.

#### Scenario: Progreso visible
- **WHEN** la conversión o la descarga del motor están en curso
- **THEN** la UI muestra el estado actual y el usuario puede seguir navegando sin congelamientos

#### Scenario: Fallo de conversión
- **WHEN** el motor falla (archivo corrupto o memoria insuficiente)
- **THEN** se muestra un mensaje accionable y la aplicación permite reintentar

### Requirement: Límites de tamaño comunicados

El sistema definirá un tamaño máximo de archivo y lo comunicará antes de la
conversión, no como error tardío.

#### Scenario: Archivo que supera el límite
- **WHEN** el archivo elegido excede el tamaño máximo permitido
- **THEN** la UI informa el límite y el peso del archivo sin intentar convertir
