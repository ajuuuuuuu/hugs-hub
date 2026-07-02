// Family tree types. Data lives in Lovable Cloud.
export type Gender = "male" | "female" | "other";

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  photoUrl?: string;
  biography?: string;
  familyGroup?: string;
}

export type RelationshipType = "parent" | "spouse";

export interface Relationship {
  id: string;
  person1Id: string;
  person2Id: string;
  type: RelationshipType;
  sortOrder?: number;
}

export const MAIN_FAMILY = "hawthorne";
