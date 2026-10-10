// Generated from project-format.schema.json; source-sha256: 85617c17f23323bf4a0fd8ef31abba6040b244f6c199c62cd40f3a389bbef789
// DO NOT EDIT. Run node tools/generate-project-format.mjs.

export type ProjectCheck = "fixed-version" | "project-id" | "entity-id" | "file-id" | "transaction-id" | "path" | "safe-integer";
export interface FormatNode {
  readonly schemaPointer: string;
  readonly ref?: string;
  readonly type?: "null" | "boolean" | "number" | "string" | "array" | "object";
  readonly const?: string | number | boolean;
  readonly enum?: readonly (string | number | boolean)[];
  readonly projectCheck?: ProjectCheck;
  readonly oneOf?: readonly FormatNode[];
  readonly items?: FormatNode;
  readonly properties?: readonly { readonly name: string; readonly required: boolean; readonly node: FormatNode }[];
  readonly required?: readonly string[];
  readonly additionalProperties?: false | FormatNode;
}

export const FORMAT_DEFINITIONS = {
  "ProjectId": {
    "schemaPointer": "#/$defs/ProjectId",
    "type": "string",
    "projectCheck": "project-id"
  },
  "EntityId": {
    "schemaPointer": "#/$defs/EntityId",
    "type": "string",
    "projectCheck": "entity-id"
  },
  "FileId": {
    "schemaPointer": "#/$defs/FileId",
    "type": "string",
    "projectCheck": "file-id"
  },
  "TransactionId": {
    "schemaPointer": "#/$defs/TransactionId",
    "type": "string",
    "projectCheck": "transaction-id"
  },
  "ProjectRevision": {
    "schemaPointer": "#/$defs/ProjectRevision",
    "type": "number",
    "projectCheck": "safe-integer"
  },
  "Sha256": {
    "schemaPointer": "#/$defs/Sha256",
    "type": "string"
  },
  "JsonValue": {
    "schemaPointer": "#/$defs/JsonValue",
    "oneOf": [
      {
        "schemaPointer": "#/$defs/JsonValue/oneOf/0",
        "type": "null"
      },
      {
        "schemaPointer": "#/$defs/JsonValue/oneOf/1",
        "type": "boolean"
      },
      {
        "schemaPointer": "#/$defs/JsonValue/oneOf/2",
        "type": "number"
      },
      {
        "schemaPointer": "#/$defs/JsonValue/oneOf/3",
        "type": "string"
      },
      {
        "schemaPointer": "#/$defs/JsonValue/oneOf/4",
        "type": "array",
        "items": {
          "schemaPointer": "#/$defs/JsonValue/oneOf/4/items",
          "ref": "JsonValue"
        }
      },
      {
        "schemaPointer": "#/$defs/JsonValue/oneOf/5",
        "type": "object",
        "additionalProperties": {
          "schemaPointer": "#/$defs/JsonValue/oneOf/5/additionalProperties",
          "ref": "JsonValue"
        }
      }
    ]
  },
  "JsonObject": {
    "schemaPointer": "#/$defs/JsonObject",
    "type": "object",
    "additionalProperties": {
      "schemaPointer": "#/$defs/JsonObject/additionalProperties",
      "ref": "JsonValue"
    }
  },
  "ProjectVersionPins": {
    "schemaPointer": "#/$defs/ProjectVersionPins",
    "type": "object",
    "properties": [
      {
        "name": "engineVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectVersionPins/properties/engineVersion",
          "type": "string"
        }
      },
      {
        "name": "resourceFormatVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectVersionPins/properties/resourceFormatVersion",
          "type": "string"
        }
      },
      {
        "name": "toolProtocolVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectVersionPins/properties/toolProtocolVersion",
          "type": "string",
          "const": "1.0",
          "projectCheck": "fixed-version"
        }
      }
    ],
    "required": [
      "engineVersion",
      "resourceFormatVersion",
      "toolProtocolVersion"
    ],
    "additionalProperties": false
  },
  "ProjectReference": {
    "schemaPointer": "#/$defs/ProjectReference",
    "oneOf": [
      {
        "schemaPointer": "#/$defs/ProjectReference/oneOf/0",
        "type": "object",
        "properties": [
          {
            "name": "slot",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectReference/oneOf/0/properties/slot",
              "type": "string"
            }
          },
          {
            "name": "target",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectReference/oneOf/0/properties/target",
              "type": "string",
              "const": "entity"
            }
          },
          {
            "name": "id",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectReference/oneOf/0/properties/id",
              "ref": "EntityId"
            }
          },
          {
            "name": "expectedKind",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectReference/oneOf/0/properties/expectedKind",
              "type": "string"
            }
          }
        ],
        "required": [
          "slot",
          "target",
          "id",
          "expectedKind"
        ],
        "additionalProperties": false
      },
      {
        "schemaPointer": "#/$defs/ProjectReference/oneOf/1",
        "type": "object",
        "properties": [
          {
            "name": "slot",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectReference/oneOf/1/properties/slot",
              "type": "string"
            }
          },
          {
            "name": "target",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectReference/oneOf/1/properties/target",
              "type": "string",
              "const": "file"
            }
          },
          {
            "name": "id",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectReference/oneOf/1/properties/id",
              "ref": "FileId"
            }
          },
          {
            "name": "expectedRole",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectReference/oneOf/1/properties/expectedRole",
              "ref": "ProjectFileRole"
            }
          }
        ],
        "required": [
          "slot",
          "target",
          "id",
          "expectedRole"
        ],
        "additionalProperties": false
      }
    ]
  },
  "ProjectEntity": {
    "schemaPointer": "#/$defs/ProjectEntity",
    "type": "object",
    "properties": [
      {
        "name": "id",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEntity/properties/id",
          "ref": "EntityId"
        }
      },
      {
        "name": "kind",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEntity/properties/kind",
          "type": "string"
        }
      },
      {
        "name": "dataSchemaVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEntity/properties/dataSchemaVersion",
          "type": "string"
        }
      },
      {
        "name": "name",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEntity/properties/name",
          "type": "string"
        }
      },
      {
        "name": "data",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEntity/properties/data",
          "ref": "JsonObject"
        }
      },
      {
        "name": "references",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEntity/properties/references",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectEntity/properties/references/items",
            "ref": "ProjectReference"
          }
        }
      }
    ],
    "required": [
      "id",
      "kind",
      "dataSchemaVersion",
      "name",
      "data",
      "references"
    ],
    "additionalProperties": false
  },
  "ProjectFileRole": {
    "schemaPointer": "#/$defs/ProjectFileRole",
    "type": "string",
    "enum": [
      "source",
      "asset",
      "configuration",
      "legacy-original",
      "other"
    ]
  },
  "ProjectFile": {
    "schemaPointer": "#/$defs/ProjectFile",
    "type": "object",
    "properties": [
      {
        "name": "id",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectFile/properties/id",
          "ref": "FileId"
        }
      },
      {
        "name": "path",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectFile/properties/path",
          "type": "string",
          "projectCheck": "path"
        }
      },
      {
        "name": "role",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectFile/properties/role",
          "ref": "ProjectFileRole"
        }
      },
      {
        "name": "mediaType",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectFile/properties/mediaType",
          "type": "string"
        }
      },
      {
        "name": "sha256",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectFile/properties/sha256",
          "ref": "Sha256"
        }
      },
      {
        "name": "byteLength",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectFile/properties/byteLength",
          "type": "number",
          "projectCheck": "safe-integer"
        }
      }
    ],
    "required": [
      "id",
      "path",
      "role",
      "mediaType",
      "sha256",
      "byteLength"
    ],
    "additionalProperties": false
  },
  "ProjectSnapshot": {
    "schemaPointer": "#/$defs/ProjectSnapshot",
    "type": "object",
    "properties": [
      {
        "name": "projectSchemaVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/projectSchemaVersion",
          "type": "string",
          "const": "1.0",
          "projectCheck": "fixed-version"
        }
      },
      {
        "name": "projectId",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/projectId",
          "ref": "ProjectId"
        }
      },
      {
        "name": "revision",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/revision",
          "ref": "ProjectRevision"
        }
      },
      {
        "name": "name",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/name",
          "type": "string"
        }
      },
      {
        "name": "versions",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/versions",
          "ref": "ProjectVersionPins"
        }
      },
      {
        "name": "roots",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/roots",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectSnapshot/properties/roots/items",
            "ref": "EntityId"
          }
        }
      },
      {
        "name": "entities",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/entities",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectSnapshot/properties/entities/items",
            "ref": "ProjectEntity"
          }
        }
      },
      {
        "name": "files",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/files",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectSnapshot/properties/files/items",
            "ref": "ProjectFile"
          }
        }
      },
      {
        "name": "retiredEntityIds",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/retiredEntityIds",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectSnapshot/properties/retiredEntityIds/items",
            "ref": "EntityId"
          }
        }
      },
      {
        "name": "retiredFileIds",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectSnapshot/properties/retiredFileIds",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectSnapshot/properties/retiredFileIds/items",
            "ref": "FileId"
          }
        }
      }
    ],
    "required": [
      "projectSchemaVersion",
      "projectId",
      "revision",
      "name",
      "versions",
      "roots",
      "entities",
      "files",
      "retiredEntityIds",
      "retiredFileIds"
    ],
    "additionalProperties": false
  },
  "ProjectTransactionSource": {
    "schemaPointer": "#/$defs/ProjectTransactionSource",
    "type": "object",
    "properties": [
      {
        "name": "actorId",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionSource/properties/actorId",
          "type": "string"
        }
      },
      {
        "name": "actorKind",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionSource/properties/actorKind",
          "type": "string",
          "enum": [
            "creator",
            "agent",
            "legacy-converter",
            "tool"
          ]
        }
      },
      {
        "name": "toolId",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionSource/properties/toolId",
          "type": "string"
        }
      },
      {
        "name": "toolVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionSource/properties/toolVersion",
          "type": "string"
        }
      },
      {
        "name": "intent",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionSource/properties/intent",
          "type": "string"
        }
      }
    ],
    "required": [
      "actorId",
      "actorKind",
      "toolId",
      "toolVersion",
      "intent"
    ],
    "additionalProperties": false
  },
  "ProjectTransactionScope": {
    "schemaPointer": "#/$defs/ProjectTransactionScope",
    "type": "object",
    "properties": [
      {
        "name": "entityIds",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionScope/properties/entityIds",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectTransactionScope/properties/entityIds/items",
            "ref": "EntityId"
          }
        }
      },
      {
        "name": "fileIds",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionScope/properties/fileIds",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectTransactionScope/properties/fileIds/items",
            "ref": "FileId"
          }
        }
      },
      {
        "name": "metadata",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionScope/properties/metadata",
          "type": "boolean"
        }
      },
      {
        "name": "roots",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectTransactionScope/properties/roots",
          "type": "boolean"
        }
      }
    ],
    "required": [
      "entityIds",
      "fileIds",
      "metadata",
      "roots"
    ],
    "additionalProperties": false
  },
  "ProjectOperation": {
    "schemaPointer": "#/$defs/ProjectOperation",
    "oneOf": [
      {
        "schemaPointer": "#/$defs/ProjectOperation/oneOf/0",
        "type": "object",
        "properties": [
          {
            "name": "op",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/0/properties/op",
              "type": "string",
              "const": "putEntity"
            }
          },
          {
            "name": "entity",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/0/properties/entity",
              "ref": "ProjectEntity"
            }
          }
        ],
        "required": [
          "op",
          "entity"
        ],
        "additionalProperties": false
      },
      {
        "schemaPointer": "#/$defs/ProjectOperation/oneOf/1",
        "type": "object",
        "properties": [
          {
            "name": "op",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/1/properties/op",
              "type": "string",
              "const": "removeEntity"
            }
          },
          {
            "name": "id",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/1/properties/id",
              "ref": "EntityId"
            }
          }
        ],
        "required": [
          "op",
          "id"
        ],
        "additionalProperties": false
      },
      {
        "schemaPointer": "#/$defs/ProjectOperation/oneOf/2",
        "type": "object",
        "properties": [
          {
            "name": "op",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/2/properties/op",
              "type": "string",
              "const": "putFile"
            }
          },
          {
            "name": "file",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/2/properties/file",
              "ref": "ProjectFile"
            }
          }
        ],
        "required": [
          "op",
          "file"
        ],
        "additionalProperties": false
      },
      {
        "schemaPointer": "#/$defs/ProjectOperation/oneOf/3",
        "type": "object",
        "properties": [
          {
            "name": "op",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/3/properties/op",
              "type": "string",
              "const": "removeFile"
            }
          },
          {
            "name": "id",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/3/properties/id",
              "ref": "FileId"
            }
          }
        ],
        "required": [
          "op",
          "id"
        ],
        "additionalProperties": false
      },
      {
        "schemaPointer": "#/$defs/ProjectOperation/oneOf/4",
        "type": "object",
        "properties": [
          {
            "name": "op",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/4/properties/op",
              "type": "string",
              "const": "setMetadata"
            }
          },
          {
            "name": "name",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/4/properties/name",
              "type": "string"
            }
          },
          {
            "name": "versions",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/4/properties/versions",
              "ref": "ProjectVersionPins"
            }
          }
        ],
        "required": [
          "op",
          "name",
          "versions"
        ],
        "additionalProperties": false
      },
      {
        "schemaPointer": "#/$defs/ProjectOperation/oneOf/5",
        "type": "object",
        "properties": [
          {
            "name": "op",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/5/properties/op",
              "type": "string",
              "const": "setRoots"
            }
          },
          {
            "name": "roots",
            "required": true,
            "node": {
              "schemaPointer": "#/$defs/ProjectOperation/oneOf/5/properties/roots",
              "type": "array",
              "items": {
                "schemaPointer": "#/$defs/ProjectOperation/oneOf/5/properties/roots/items",
                "ref": "EntityId"
              }
            }
          }
        ],
        "required": [
          "op",
          "roots"
        ],
        "additionalProperties": false
      }
    ]
  },
  "ProjectEditTransaction": {
    "schemaPointer": "#/$defs/ProjectEditTransaction",
    "type": "object",
    "properties": [
      {
        "name": "command",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEditTransaction/properties/command",
          "type": "string",
          "const": "edit"
        }
      },
      {
        "name": "toolProtocolVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEditTransaction/properties/toolProtocolVersion",
          "type": "string",
          "const": "1.0",
          "projectCheck": "fixed-version"
        }
      },
      {
        "name": "projectId",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEditTransaction/properties/projectId",
          "ref": "ProjectId"
        }
      },
      {
        "name": "transactionId",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEditTransaction/properties/transactionId",
          "ref": "TransactionId"
        }
      },
      {
        "name": "baseRevision",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEditTransaction/properties/baseRevision",
          "ref": "ProjectRevision"
        }
      },
      {
        "name": "source",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEditTransaction/properties/source",
          "ref": "ProjectTransactionSource"
        }
      },
      {
        "name": "scope",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEditTransaction/properties/scope",
          "ref": "ProjectTransactionScope"
        }
      },
      {
        "name": "operations",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectEditTransaction/properties/operations",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectEditTransaction/properties/operations/items",
            "ref": "ProjectOperation"
          }
        }
      }
    ],
    "required": [
      "command",
      "toolProtocolVersion",
      "projectId",
      "transactionId",
      "baseRevision",
      "source",
      "scope",
      "operations"
    ],
    "additionalProperties": false
  },
  "ProjectRestoreTransaction": {
    "schemaPointer": "#/$defs/ProjectRestoreTransaction",
    "type": "object",
    "properties": [
      {
        "name": "command",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectRestoreTransaction/properties/command",
          "type": "string",
          "const": "restore"
        }
      },
      {
        "name": "toolProtocolVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectRestoreTransaction/properties/toolProtocolVersion",
          "type": "string",
          "const": "1.0",
          "projectCheck": "fixed-version"
        }
      },
      {
        "name": "projectId",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectRestoreTransaction/properties/projectId",
          "ref": "ProjectId"
        }
      },
      {
        "name": "transactionId",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectRestoreTransaction/properties/transactionId",
          "ref": "TransactionId"
        }
      },
      {
        "name": "baseRevision",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectRestoreTransaction/properties/baseRevision",
          "ref": "ProjectRevision"
        }
      },
      {
        "name": "source",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectRestoreTransaction/properties/source",
          "ref": "ProjectTransactionSource"
        }
      },
      {
        "name": "targetRevision",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectRestoreTransaction/properties/targetRevision",
          "ref": "ProjectRevision"
        }
      }
    ],
    "required": [
      "command",
      "toolProtocolVersion",
      "projectId",
      "transactionId",
      "baseRevision",
      "source",
      "targetRevision"
    ],
    "additionalProperties": false
  },
  "ProjectTransaction": {
    "schemaPointer": "#/$defs/ProjectTransaction",
    "oneOf": [
      {
        "schemaPointer": "#/$defs/ProjectTransaction/oneOf/0",
        "ref": "ProjectEditTransaction"
      },
      {
        "schemaPointer": "#/$defs/ProjectTransaction/oneOf/1",
        "ref": "ProjectRestoreTransaction"
      }
    ]
  },
  "ProjectHistory": {
    "schemaPointer": "#/$defs/ProjectHistory",
    "type": "object",
    "properties": [
      {
        "name": "historySchemaVersion",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectHistory/properties/historySchemaVersion",
          "type": "string",
          "const": "1.0",
          "projectCheck": "fixed-version"
        }
      },
      {
        "name": "baseline",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectHistory/properties/baseline",
          "ref": "ProjectSnapshot"
        }
      },
      {
        "name": "transactions",
        "required": true,
        "node": {
          "schemaPointer": "#/$defs/ProjectHistory/properties/transactions",
          "type": "array",
          "items": {
            "schemaPointer": "#/$defs/ProjectHistory/properties/transactions/items",
            "ref": "ProjectTransaction"
          }
        }
      }
    ],
    "required": [
      "historySchemaVersion",
      "baseline",
      "transactions"
    ],
    "additionalProperties": false
  }
} as const satisfies Readonly<Record<string, FormatNode>>;
