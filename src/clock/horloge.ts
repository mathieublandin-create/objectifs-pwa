export interface Horloge {
  maintenant(): Date;
}

export const horlogeSysteme: Horloge = {
  maintenant: () => new Date(),
};

export const genIdSeq = (): (() => string) => {
  let seq = 0;
  return () => "id" + Date.now() + "_" + ++seq;
};
