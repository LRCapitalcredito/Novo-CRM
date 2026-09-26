export type AccessRole = "editor" | "reader";
export type Invitation = {email:string;name:string;role:AccessRole;active:boolean;version:number;claimedUid:string};
export type TeamMember = {uid:string;email?:string;name:string;role:"admin"|AccessRole;active:boolean};
export type TeamState = {invitations:Invitation[];members:TeamMember[]};
export function invitationInput(email:string,name:string,role:AccessRole) {
  email=email.trim().toLowerCase(); name=name.trim();
  if(!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)||email.length>180) throw Error("Informe o e-mail da conta Google do sócio.");
  if(!name||name.length>100) throw Error("Informe um nome de até 100 caracteres.");
  if(!["editor","reader"].includes(role)) throw Error("Selecione uma permissão válida.");
  return {email,name,role};
}
