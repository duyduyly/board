const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Card Atlas Project 1.0',
  type: 'object',
  required: ['version', 'cards', 'relations'],
  additionalProperties: false,
  properties: {
    version: {
      const: '1.0',
    },
    metadata: {
      $ref: '#/$defs/metadata',
    },
    canvas: {
      $ref: '#/$defs/canvas',
    },
    cards: {
      type: 'array',
      maxItems: 500,
      items: {
        $ref: '#/$defs/card',
      },
    },
    relations: {
      type: 'array',
      maxItems: 2000,
      items: {
        $ref: '#/$defs/relation',
      },
    },
    extensions: {
      $ref: '#/$defs/extensions',
    },
  },
  $defs: {
    id: {
      type: 'string',
      minLength: 1,
      pattern: '^\\S(?:[\\s\\S]*\\S)?$',
    },
    color: {
      type: 'string',
      pattern: '^#[0-9a-fA-F]{6}$',
    },
    point: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y'],
      properties: {
        x: {
          type: 'number',
        },
        y: {
          type: 'number',
        },
      },
    },
    size: {
      type: 'object',
      additionalProperties: false,
      required: ['width', 'height'],
      properties: {
        width: {
          type: 'number',
          exclusiveMinimum: 0,
        },
        height: {
          type: 'number',
          exclusiveMinimum: 0,
        },
      },
    },
    extensions: {
      type: 'object',
      propertyNames: {
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]*:.+$',
      },
    },
    metadata: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
      },
    },
    canvas: {
      type: 'object',
      additionalProperties: false,
      properties: {
        zoom: {
          type: 'number',
          minimum: 0.1,
          maximum: 4,
        },
        position: {
          $ref: '#/$defs/point',
        },
      },
    },
    card: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'title'],
      properties: {
        id: {
          $ref: '#/$defs/id',
        },
        title: {
          type: 'string',
          pattern: '\\S',
        },
        summary: {
          type: 'string',
        },
        type: {
          type: 'string',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        content: {
          type: 'string',
          maxLength: 100000,
        },
        position: {
          $ref: '#/$defs/point',
        },
        size: {
          $ref: '#/$defs/size',
        },
        style: {
          type: 'object',
          additionalProperties: false,
          properties: {
            backgroundColor: {
              $ref: '#/$defs/color',
            },
            textColor: {
              $ref: '#/$defs/color',
            },
            borderColor: {
              $ref: '#/$defs/color',
            },
          },
        },
        extensions: {
          $ref: '#/$defs/extensions',
        },
      },
    },
    relation: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'source', 'target'],
      properties: {
        id: {
          $ref: '#/$defs/id',
        },
        source: {
          $ref: '#/$defs/id',
        },
        target: {
          $ref: '#/$defs/id',
        },
        label: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        type: {
          type: 'string',
        },
        style: {
          type: 'object',
          additionalProperties: false,
          properties: {
            color: {
              $ref: '#/$defs/color',
            },
            line: {
              enum: ['solid', 'dashed', 'dotted'],
            },
            arrow: {
              enum: ['none', 'start', 'end', 'both'],
            },
          },
        },
        extensions: {
          $ref: '#/$defs/extensions',
        },
      },
    },
  },
};

const object = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
schema.$defs.nodePresentation = object(
  {
    kind: { enum: ['card', 'text', 'image', 'image-text'] },
    coverImageId: { type: 'string', minLength: 1 },
    imageFit: { enum: ['contain', 'cover'] },
    imageAlt: { type: 'string' },
  },
  ['kind'],
);
schema.$defs.nodePresentation.allOf = [
  {
    if: { properties: { kind: { enum: ['image', 'image-text'] } } },
    then: { required: ['coverImageId'] },
  },
];
schema.$defs.mindView = object({
  positions: { type: 'object', additionalProperties: { $ref: '#/$defs/point' } },
  sizes: { type: 'object', additionalProperties: { $ref: '#/$defs/size' } },
  viewport: object(
    { zoom: { type: 'number', minimum: 0.1, maximum: 4 }, position: { $ref: '#/$defs/point' } },
    ['zoom', 'position'],
  ),
});
const extensions = (properties) => ({ ...schema.$defs.extensions, properties });
schema.properties.extensions = extensions({
  'card-atlas:views': object({ mindMap: { $ref: '#/$defs/mindView' } }),
  'card-atlas:mind-map': object({ rootId: { $ref: '#/$defs/id' } }),
});
schema.$defs.card.properties.extensions = extensions({
  'card-atlas:node': { $ref: '#/$defs/nodePresentation' },
});
schema.$defs.relation.properties.extensions = extensions({
  'card-atlas:mind-map': object(
    { kind: { enum: ['branch', 'reference'] }, color: { $ref: '#/$defs/color' } },
    ['kind'],
  ),
});
export default schema;
