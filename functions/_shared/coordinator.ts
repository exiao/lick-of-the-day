export interface CoordinatorStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CoordinatorNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): CoordinatorStub;
}
