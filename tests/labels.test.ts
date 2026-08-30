import { describe, it, expect } from "vitest";
import {
  ENTITY_TYPE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
  FLOW_TYPE_LABELS,
  CONFIDENCE_LABELS,
  CHANGE_EVENT_LABELS,
  entityLabel,
  relationshipLabel,
  flowLabel,
} from "@/lib/constants";
import {
  EntityType,
  RelationshipType,
  FlowType,
  Confidence,
  ChangeEventType,
} from "@prisma/client";

describe("label coverage invariants", () => {
  it("every entity type has a Finnish and English label", () => {
    const values = Object.values(EntityType);
    expect(values.length).toBeGreaterThan(10);
    for (const v of values) {
      expect(ENTITY_TYPE_LABELS[v].fi).toBeTruthy();
      expect(ENTITY_TYPE_LABELS[v].en).toBeTruthy();
    }
  });

  it("every relationship type has a label", () => {
    for (const v of Object.values(RelationshipType)) {
      expect(RELATIONSHIP_TYPE_LABELS[v].fi).toBeTruthy();
    }
  });

  it("every flow type has a label", () => {
    for (const v of Object.values(FlowType)) {
      expect(FLOW_TYPE_LABELS[v].fi).toBeTruthy();
    }
  });

  it("every confidence level has a label", () => {
    for (const v of Object.values(Confidence)) {
      expect(CONFIDENCE_LABELS[v].fi).toBeTruthy();
    }
  });

  it("every change event has a label", () => {
    for (const v of Object.values(ChangeEventType)) {
      expect(CHANGE_EVENT_LABELS[v].fi).toBeTruthy();
    }
  });
});

describe("label accessors", () => {
  it("returns labels and falls back gracefully", () => {
    expect(entityLabel("PERSON")).toBe("Henkilö");
    expect(relationshipLabel("MEMBER_OF")).toBe("jäsen");
    expect(flowLabel("PROCUREMENT")).toBe("Julkinen hankinta");
  });
});
