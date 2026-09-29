# Spec Delta

## Purpose

Garantizar que los documentos del usuario no se expongan a ningún servicio:
ni servidores propios, ni terceros, ni almacenamiento intermedio.

## ADDED Requirements

### Requirement: Cero envío de archivos a la red

Durante toda la conversión el contenido del archivo del usuario no viajará en
ninguna petición de red. Las únicas descargas de red serán los assets estáticos
del sitio y del motor WASM, que no contienen datos del usuario.

#### Scenario: Conversión normal
- **WHEN** el usuario convierte un documento
- **THEN** no se emiten peticiones HTTP que contengan el archivo ni su contenido

#### Scenario: Auditoría fácil
- **WHEN** un usuario revisa el código fuente publicado o usa las herramientas de red del navegador
- **THEN** puede comprobar que no existe backend al que se suban documentos

### Requirement: Sin persistencia de documentos

Los archivos y resultados existirán únicamente en memoria (y Scratch/OPFS del
navegador) durante la operación; no se guardarán en almacenamiento durable ni
se transmitirán a terceros, y los blobs se liberarán al terminar.

#### Scenario: Después de la conversión
- **WHEN** la conversión termina (éxito o error)
- **THEN** los buffers y blobs intermedios se liberan y no queda copia persistente del documento

### Requirement: Transparencia como producto

La promesa de privacidad se sostiene con código abierto público bajo
AGPL-3.0 y con copy que describe exactamente lo que ocurre (sin afirmaciones
de más).

#### Scenario: Usuario escéptico
- **WHEN** un usuario lee la sección de privacidad y el README
- **THEN** encuentran una descripción verificable y consistente con la arquitectura real
