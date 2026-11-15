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
    readonly properties?: readonly {
        readonly name: string;
        readonly required: boolean;
        readonly node: FormatNode;
    }[];
    readonly required?: readonly string[];
    readonly additionalProperties?: false | FormatNode;
}
export declare const FORMAT_DEFINITIONS: {
    readonly ProjectId: {
        readonly schemaPointer: "#/$defs/ProjectId";
        readonly type: "string";
        readonly projectCheck: "project-id";
    };
    readonly EntityId: {
        readonly schemaPointer: "#/$defs/EntityId";
        readonly type: "string";
        readonly projectCheck: "entity-id";
    };
    readonly FileId: {
        readonly schemaPointer: "#/$defs/FileId";
        readonly type: "string";
        readonly projectCheck: "file-id";
    };
    readonly TransactionId: {
        readonly schemaPointer: "#/$defs/TransactionId";
        readonly type: "string";
        readonly projectCheck: "transaction-id";
    };
    readonly ProjectRevision: {
        readonly schemaPointer: "#/$defs/ProjectRevision";
        readonly type: "number";
        readonly projectCheck: "safe-integer";
    };
    readonly Sha256: {
        readonly schemaPointer: "#/$defs/Sha256";
        readonly type: "string";
    };
    readonly JsonValue: {
        readonly schemaPointer: "#/$defs/JsonValue";
        readonly oneOf: readonly [{
            readonly schemaPointer: "#/$defs/JsonValue/oneOf/0";
            readonly type: "null";
        }, {
            readonly schemaPointer: "#/$defs/JsonValue/oneOf/1";
            readonly type: "boolean";
        }, {
            readonly schemaPointer: "#/$defs/JsonValue/oneOf/2";
            readonly type: "number";
        }, {
            readonly schemaPointer: "#/$defs/JsonValue/oneOf/3";
            readonly type: "string";
        }, {
            readonly schemaPointer: "#/$defs/JsonValue/oneOf/4";
            readonly type: "array";
            readonly items: {
                readonly schemaPointer: "#/$defs/JsonValue/oneOf/4/items";
                readonly ref: "JsonValue";
            };
        }, {
            readonly schemaPointer: "#/$defs/JsonValue/oneOf/5";
            readonly type: "object";
            readonly additionalProperties: {
                readonly schemaPointer: "#/$defs/JsonValue/oneOf/5/additionalProperties";
                readonly ref: "JsonValue";
            };
        }];
    };
    readonly JsonObject: {
        readonly schemaPointer: "#/$defs/JsonObject";
        readonly type: "object";
        readonly additionalProperties: {
            readonly schemaPointer: "#/$defs/JsonObject/additionalProperties";
            readonly ref: "JsonValue";
        };
    };
    readonly ProjectVersionPins: {
        readonly schemaPointer: "#/$defs/ProjectVersionPins";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "engineVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectVersionPins/properties/engineVersion";
                readonly type: "string";
            };
        }, {
            readonly name: "resourceFormatVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectVersionPins/properties/resourceFormatVersion";
                readonly type: "string";
            };
        }, {
            readonly name: "toolProtocolVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectVersionPins/properties/toolProtocolVersion";
                readonly type: "string";
                readonly const: "1.0";
                readonly projectCheck: "fixed-version";
            };
        }];
        readonly required: readonly ["engineVersion", "resourceFormatVersion", "toolProtocolVersion"];
        readonly additionalProperties: false;
    };
    readonly ProjectReference: {
        readonly schemaPointer: "#/$defs/ProjectReference";
        readonly oneOf: readonly [{
            readonly schemaPointer: "#/$defs/ProjectReference/oneOf/0";
            readonly type: "object";
            readonly properties: readonly [{
                readonly name: "slot";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectReference/oneOf/0/properties/slot";
                    readonly type: "string";
                };
            }, {
                readonly name: "target";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectReference/oneOf/0/properties/target";
                    readonly type: "string";
                    readonly const: "entity";
                };
            }, {
                readonly name: "id";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectReference/oneOf/0/properties/id";
                    readonly ref: "EntityId";
                };
            }, {
                readonly name: "expectedKind";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectReference/oneOf/0/properties/expectedKind";
                    readonly type: "string";
                };
            }];
            readonly required: readonly ["slot", "target", "id", "expectedKind"];
            readonly additionalProperties: false;
        }, {
            readonly schemaPointer: "#/$defs/ProjectReference/oneOf/1";
            readonly type: "object";
            readonly properties: readonly [{
                readonly name: "slot";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectReference/oneOf/1/properties/slot";
                    readonly type: "string";
                };
            }, {
                readonly name: "target";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectReference/oneOf/1/properties/target";
                    readonly type: "string";
                    readonly const: "file";
                };
            }, {
                readonly name: "id";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectReference/oneOf/1/properties/id";
                    readonly ref: "FileId";
                };
            }, {
                readonly name: "expectedRole";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectReference/oneOf/1/properties/expectedRole";
                    readonly ref: "ProjectFileRole";
                };
            }];
            readonly required: readonly ["slot", "target", "id", "expectedRole"];
            readonly additionalProperties: false;
        }];
    };
    readonly ProjectEntity: {
        readonly schemaPointer: "#/$defs/ProjectEntity";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "id";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEntity/properties/id";
                readonly ref: "EntityId";
            };
        }, {
            readonly name: "kind";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEntity/properties/kind";
                readonly type: "string";
            };
        }, {
            readonly name: "dataSchemaVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEntity/properties/dataSchemaVersion";
                readonly type: "string";
            };
        }, {
            readonly name: "name";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEntity/properties/name";
                readonly type: "string";
            };
        }, {
            readonly name: "data";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEntity/properties/data";
                readonly ref: "JsonObject";
            };
        }, {
            readonly name: "references";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEntity/properties/references";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectEntity/properties/references/items";
                    readonly ref: "ProjectReference";
                };
            };
        }];
        readonly required: readonly ["id", "kind", "dataSchemaVersion", "name", "data", "references"];
        readonly additionalProperties: false;
    };
    readonly ProjectFileRole: {
        readonly schemaPointer: "#/$defs/ProjectFileRole";
        readonly type: "string";
        readonly enum: readonly ["source", "asset", "configuration", "legacy-original", "other"];
    };
    readonly ProjectFile: {
        readonly schemaPointer: "#/$defs/ProjectFile";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "id";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectFile/properties/id";
                readonly ref: "FileId";
            };
        }, {
            readonly name: "path";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectFile/properties/path";
                readonly type: "string";
                readonly projectCheck: "path";
            };
        }, {
            readonly name: "role";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectFile/properties/role";
                readonly ref: "ProjectFileRole";
            };
        }, {
            readonly name: "mediaType";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectFile/properties/mediaType";
                readonly type: "string";
            };
        }, {
            readonly name: "sha256";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectFile/properties/sha256";
                readonly ref: "Sha256";
            };
        }, {
            readonly name: "byteLength";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectFile/properties/byteLength";
                readonly type: "number";
                readonly projectCheck: "safe-integer";
            };
        }];
        readonly required: readonly ["id", "path", "role", "mediaType", "sha256", "byteLength"];
        readonly additionalProperties: false;
    };
    readonly ProjectSnapshot: {
        readonly schemaPointer: "#/$defs/ProjectSnapshot";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "projectSchemaVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/projectSchemaVersion";
                readonly type: "string";
                readonly const: "1.0";
                readonly projectCheck: "fixed-version";
            };
        }, {
            readonly name: "projectId";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/projectId";
                readonly ref: "ProjectId";
            };
        }, {
            readonly name: "revision";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/revision";
                readonly ref: "ProjectRevision";
            };
        }, {
            readonly name: "name";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/name";
                readonly type: "string";
            };
        }, {
            readonly name: "versions";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/versions";
                readonly ref: "ProjectVersionPins";
            };
        }, {
            readonly name: "roots";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/roots";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/roots/items";
                    readonly ref: "EntityId";
                };
            };
        }, {
            readonly name: "entities";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/entities";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/entities/items";
                    readonly ref: "ProjectEntity";
                };
            };
        }, {
            readonly name: "files";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/files";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/files/items";
                    readonly ref: "ProjectFile";
                };
            };
        }, {
            readonly name: "retiredEntityIds";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/retiredEntityIds";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/retiredEntityIds/items";
                    readonly ref: "EntityId";
                };
            };
        }, {
            readonly name: "retiredFileIds";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/retiredFileIds";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectSnapshot/properties/retiredFileIds/items";
                    readonly ref: "FileId";
                };
            };
        }];
        readonly required: readonly ["projectSchemaVersion", "projectId", "revision", "name", "versions", "roots", "entities", "files", "retiredEntityIds", "retiredFileIds"];
        readonly additionalProperties: false;
    };
    readonly ProjectTransactionSource: {
        readonly schemaPointer: "#/$defs/ProjectTransactionSource";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "actorId";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionSource/properties/actorId";
                readonly type: "string";
            };
        }, {
            readonly name: "actorKind";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionSource/properties/actorKind";
                readonly type: "string";
                readonly enum: readonly ["creator", "agent", "legacy-converter", "tool"];
            };
        }, {
            readonly name: "toolId";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionSource/properties/toolId";
                readonly type: "string";
            };
        }, {
            readonly name: "toolVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionSource/properties/toolVersion";
                readonly type: "string";
            };
        }, {
            readonly name: "intent";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionSource/properties/intent";
                readonly type: "string";
            };
        }];
        readonly required: readonly ["actorId", "actorKind", "toolId", "toolVersion", "intent"];
        readonly additionalProperties: false;
    };
    readonly ProjectTransactionScope: {
        readonly schemaPointer: "#/$defs/ProjectTransactionScope";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "entityIds";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionScope/properties/entityIds";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectTransactionScope/properties/entityIds/items";
                    readonly ref: "EntityId";
                };
            };
        }, {
            readonly name: "fileIds";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionScope/properties/fileIds";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectTransactionScope/properties/fileIds/items";
                    readonly ref: "FileId";
                };
            };
        }, {
            readonly name: "metadata";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionScope/properties/metadata";
                readonly type: "boolean";
            };
        }, {
            readonly name: "roots";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectTransactionScope/properties/roots";
                readonly type: "boolean";
            };
        }];
        readonly required: readonly ["entityIds", "fileIds", "metadata", "roots"];
        readonly additionalProperties: false;
    };
    readonly ProjectOperation: {
        readonly schemaPointer: "#/$defs/ProjectOperation";
        readonly oneOf: readonly [{
            readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/0";
            readonly type: "object";
            readonly properties: readonly [{
                readonly name: "op";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/0/properties/op";
                    readonly type: "string";
                    readonly const: "putEntity";
                };
            }, {
                readonly name: "entity";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/0/properties/entity";
                    readonly ref: "ProjectEntity";
                };
            }];
            readonly required: readonly ["op", "entity"];
            readonly additionalProperties: false;
        }, {
            readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/1";
            readonly type: "object";
            readonly properties: readonly [{
                readonly name: "op";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/1/properties/op";
                    readonly type: "string";
                    readonly const: "removeEntity";
                };
            }, {
                readonly name: "id";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/1/properties/id";
                    readonly ref: "EntityId";
                };
            }];
            readonly required: readonly ["op", "id"];
            readonly additionalProperties: false;
        }, {
            readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/2";
            readonly type: "object";
            readonly properties: readonly [{
                readonly name: "op";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/2/properties/op";
                    readonly type: "string";
                    readonly const: "putFile";
                };
            }, {
                readonly name: "file";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/2/properties/file";
                    readonly ref: "ProjectFile";
                };
            }];
            readonly required: readonly ["op", "file"];
            readonly additionalProperties: false;
        }, {
            readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/3";
            readonly type: "object";
            readonly properties: readonly [{
                readonly name: "op";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/3/properties/op";
                    readonly type: "string";
                    readonly const: "removeFile";
                };
            }, {
                readonly name: "id";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/3/properties/id";
                    readonly ref: "FileId";
                };
            }];
            readonly required: readonly ["op", "id"];
            readonly additionalProperties: false;
        }, {
            readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/4";
            readonly type: "object";
            readonly properties: readonly [{
                readonly name: "op";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/4/properties/op";
                    readonly type: "string";
                    readonly const: "setMetadata";
                };
            }, {
                readonly name: "name";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/4/properties/name";
                    readonly type: "string";
                };
            }, {
                readonly name: "versions";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/4/properties/versions";
                    readonly ref: "ProjectVersionPins";
                };
            }];
            readonly required: readonly ["op", "name", "versions"];
            readonly additionalProperties: false;
        }, {
            readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/5";
            readonly type: "object";
            readonly properties: readonly [{
                readonly name: "op";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/5/properties/op";
                    readonly type: "string";
                    readonly const: "setRoots";
                };
            }, {
                readonly name: "roots";
                readonly required: true;
                readonly node: {
                    readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/5/properties/roots";
                    readonly type: "array";
                    readonly items: {
                        readonly schemaPointer: "#/$defs/ProjectOperation/oneOf/5/properties/roots/items";
                        readonly ref: "EntityId";
                    };
                };
            }];
            readonly required: readonly ["op", "roots"];
            readonly additionalProperties: false;
        }];
    };
    readonly ProjectEditTransaction: {
        readonly schemaPointer: "#/$defs/ProjectEditTransaction";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "command";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/command";
                readonly type: "string";
                readonly const: "edit";
            };
        }, {
            readonly name: "toolProtocolVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/toolProtocolVersion";
                readonly type: "string";
                readonly const: "1.0";
                readonly projectCheck: "fixed-version";
            };
        }, {
            readonly name: "projectId";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/projectId";
                readonly ref: "ProjectId";
            };
        }, {
            readonly name: "transactionId";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/transactionId";
                readonly ref: "TransactionId";
            };
        }, {
            readonly name: "baseRevision";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/baseRevision";
                readonly ref: "ProjectRevision";
            };
        }, {
            readonly name: "source";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/source";
                readonly ref: "ProjectTransactionSource";
            };
        }, {
            readonly name: "scope";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/scope";
                readonly ref: "ProjectTransactionScope";
            };
        }, {
            readonly name: "operations";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/operations";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectEditTransaction/properties/operations/items";
                    readonly ref: "ProjectOperation";
                };
            };
        }];
        readonly required: readonly ["command", "toolProtocolVersion", "projectId", "transactionId", "baseRevision", "source", "scope", "operations"];
        readonly additionalProperties: false;
    };
    readonly ProjectRestoreTransaction: {
        readonly schemaPointer: "#/$defs/ProjectRestoreTransaction";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "command";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectRestoreTransaction/properties/command";
                readonly type: "string";
                readonly const: "restore";
            };
        }, {
            readonly name: "toolProtocolVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectRestoreTransaction/properties/toolProtocolVersion";
                readonly type: "string";
                readonly const: "1.0";
                readonly projectCheck: "fixed-version";
            };
        }, {
            readonly name: "projectId";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectRestoreTransaction/properties/projectId";
                readonly ref: "ProjectId";
            };
        }, {
            readonly name: "transactionId";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectRestoreTransaction/properties/transactionId";
                readonly ref: "TransactionId";
            };
        }, {
            readonly name: "baseRevision";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectRestoreTransaction/properties/baseRevision";
                readonly ref: "ProjectRevision";
            };
        }, {
            readonly name: "source";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectRestoreTransaction/properties/source";
                readonly ref: "ProjectTransactionSource";
            };
        }, {
            readonly name: "targetRevision";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectRestoreTransaction/properties/targetRevision";
                readonly ref: "ProjectRevision";
            };
        }];
        readonly required: readonly ["command", "toolProtocolVersion", "projectId", "transactionId", "baseRevision", "source", "targetRevision"];
        readonly additionalProperties: false;
    };
    readonly ProjectTransaction: {
        readonly schemaPointer: "#/$defs/ProjectTransaction";
        readonly oneOf: readonly [{
            readonly schemaPointer: "#/$defs/ProjectTransaction/oneOf/0";
            readonly ref: "ProjectEditTransaction";
        }, {
            readonly schemaPointer: "#/$defs/ProjectTransaction/oneOf/1";
            readonly ref: "ProjectRestoreTransaction";
        }];
    };
    readonly ProjectHistory: {
        readonly schemaPointer: "#/$defs/ProjectHistory";
        readonly type: "object";
        readonly properties: readonly [{
            readonly name: "historySchemaVersion";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectHistory/properties/historySchemaVersion";
                readonly type: "string";
                readonly const: "1.0";
                readonly projectCheck: "fixed-version";
            };
        }, {
            readonly name: "baseline";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectHistory/properties/baseline";
                readonly ref: "ProjectSnapshot";
            };
        }, {
            readonly name: "transactions";
            readonly required: true;
            readonly node: {
                readonly schemaPointer: "#/$defs/ProjectHistory/properties/transactions";
                readonly type: "array";
                readonly items: {
                    readonly schemaPointer: "#/$defs/ProjectHistory/properties/transactions/items";
                    readonly ref: "ProjectTransaction";
                };
            };
        }];
        readonly required: readonly ["historySchemaVersion", "baseline", "transactions"];
        readonly additionalProperties: false;
    };
};
//# sourceMappingURL=format-shape.generated.d.ts.map