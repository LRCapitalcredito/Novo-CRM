import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  getDocs,
  doc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { Repository } from "./repository";
import {invitationInput, type TeamState} from "./team";
import { assertPlacementFit, needsFitCheck } from "./institutionFit";
import type { Bank, Manager } from "./directory";
import { isWorkflowKind, validateWorkflowLinks } from "./workflow";
import {
  validateRecord,
  type WorkspaceRecord,
  type RecordEvent,
} from "./records";
import {
  validateDirectory,
  directoryChanges,
  emptyDirectory,
  type DirectoryRecord,
  type DirectoryEvent,
} from "./directory";
import {
  validateOperation,
  type Session,
  type WorkspaceState,
  type Operation,
  type Activity,
} from "./domain";
type Config = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  workspaceId?: string;
  passwordLoginEnabled?: boolean;
};
const iso = (value: any) => value?.toDate?.().toISOString?.() || "";
export function firebaseRepository(config: Config): Repository {
  const app = initializeApp(config, "lr-v2");
  const auth = getAuth(app);
  const db = getFirestore(app);
  const workspace = config.workspaceId || "lr-capital";
  if (!/^[\w-]{1,64}$/.test(workspace)) throw new Error("Workspace inválido.");
  const root = `lr_v2_workspaces/${workspace}`;
  let membershipUnsub: (() => void) | undefined;
  const repo: Repository = {
    mode: "firebase",
    passwordLoginEnabled: config.passwordLoginEnabled !== false,
    async listDriveFolders() {
      const result=await getDocs(collection(db,root,"driveFolders"));
      return result.docs.map(d=>({name:d.data().name as string,url:d.data().url as string}));
    },
    subscribeTeam(next,error) {
      let state:TeamState={members:[],invitations:[]};
      const fail=()=>error("Não foi possível carregar os acessos da equipe.");
      const a=onSnapshot(collection(db,root,"members"),snap=>{state={...state,members:snap.docs.map(d=>({...d.data(),uid:d.id} as TeamState["members"][number]))};next(state);},fail);
      const b=onSnapshot(collection(db,root,"invitations"),snap=>{state={...state,invitations:snap.docs.map(d=>d.data() as TeamState["invitations"][number])};next(state);},fail);
      return ()=>{a();b();};
    },
    async saveInvitation(raw,expectedVersion) {
      if(repo.session?.role!=="admin")throw Error("Somente o administrador pode cadastrar acessos.");
      const input=invitationInput(raw.email,raw.name,raw.role),target=doc(db,root,"invitations",input.email);
      await runTransaction(db,async tx=>{
        const current=await tx.get(target),old=current.data();
        if((old?.version??null)!==expectedVersion)throw Error("O convite mudou. Confira a lista e tente novamente.");
        if(old?.claimedUid)throw Error("Convite já utilizado. Altere o usuário na lista da equipe.");
        tx.set(target,{...input,active:raw.active,claimedUid:"",version:(old?.version??0)+1,createdAt:old?.createdAt??serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:repo.session!.uid});
      });
    },
    async changeMemberAccess(member,active,role) {
      if(repo.session?.role!=="admin"||member.uid===repo.session.uid||member.role==="admin")throw Error("Este acesso de administrador deve ser preservado.");
      if(!["editor","reader"].includes(role))throw Error("Permissão inválida.");
      await runTransaction(db,async tx=>{
        const target=doc(db,root,"members",member.uid),current=await tx.get(target),old=current.data();
        if(!old||old.active!==member.active||old.role!==member.role)throw Error("O acesso mudou. Confira a lista e tente novamente.");
        tx.update(target,{active,role});
      });
    },
    async saveRecord(raw, expectedVersion) {
      if (!auth.currentUser || !repo.session || repo.session.role === "reader")
        throw new Error("Sem permissão para alterar.");
      const input = validateRecord(raw),
        target = doc(db, root, "records", input.id),
        audit = doc(collection(db, root, "recordEvents")),
        actor = repo.session;
      await runTransaction(db, async (tx) => {
        const current = await tx.get(target),
          old = current.exists() ? current.data() : null;
        if ((old?.version ?? null) !== expectedVersion)
          throw new Error(
            "O registro mudou em outra sessão. Reabra antes de salvar.",
          );
        if (
          old &&
          (old.kind !== input.kind || old.operationId !== input.operationId)
        )
          throw new Error("Vínculo não pode ser alterado.");
        if (
          input.kind !== "template" &&
          !(
            await tx.get(doc(db, root, "operations", input.operationId))
          ).exists()
        )
          throw new Error("Operação não encontrada.");
        if (input.kind === "placement" && input.data.bankId) {
          const bank = await tx.get(
            doc(db, root, "directory", input.data.bankId),
          );
          if (!bank.exists() || bank.data().kind !== "bank")
            throw new Error("Instituição não encontrada.");
          if (input.data.managerId) {
            const manager = await tx.get(
              doc(db, root, "directory", input.data.managerId),
            );
            if (
              !manager.exists() ||
              manager.data().kind !== "manager" ||
              manager.data().bankId !== input.data.bankId
            )
              throw new Error(
                "O gerente precisa pertencer à instituição vinculada.",
              );
          }
        }
        const oldRecord = old ? { ...old, data: JSON.parse(old.contentJson) } as WorkspaceRecord : null;
        if (needsFitCheck(input, oldRecord)) {
          const op = await tx.get(doc(db, root, "operations", input.operationId));
          const profile = await tx.get(doc(db, root, "records", `profile-${input.operationId}`));
          const bank = input.data.bankId ? await tx.get(doc(db, root, "directory", input.data.bankId)) : null;
          const manager = input.data.managerId ? await tx.get(doc(db, root, "directory", input.data.managerId)) : null;
          assertPlacementFit(input, oldRecord, op.data() as Operation, profile.exists() ? JSON.parse(profile.data().contentJson) : {}, bank?.data() as Bank | undefined, manager?.data() as Manager | undefined);
        }
        const relatedIds = [input.data.placementId, ...(input.kind === "dispatch" && !old ? input.data.items.map((item: any) => item.documentId) : [])].filter(Boolean);
        const related: WorkspaceRecord[] = [];
        for (const id of new Set<string>(relatedIds)) {
          const snap = await tx.get(doc(db, root, "records", id));
          if (snap.exists()) related.push({ ...snap.data(), data: JSON.parse(snap.data().contentJson) } as WorkspaceRecord);
        }
        validateWorkflowLinks(input, oldRecord, related);
        const version = (old?.version ?? 0) + 1,
          contentJson = JSON.stringify(input.data);
        tx.set(target, {
          id: input.id,
          kind: input.kind,
          operationId: input.operationId,
          contentJson,
          version,
          createdAt: old?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
          lastEventId: audit.id,
        });
        tx.set(audit, {
          recordId: input.id,
          operationId: input.operationId,
          kind: input.kind,
          actor: actor.name,
          actorUid: actor.uid,
          at: serverTimestamp(),
          version,
          ...(isWorkflowKind(input.kind) ? { contentJson } : {}),
        });
      });
    },
    session: null,
    authListener(callback) {
      getRedirectResult(auth).catch(() => callback(null, "O acesso Google não foi concluído. Tente novamente com a conta habilitada."));
      let generation=0;
      const unsub = onAuthStateChanged(auth, async (user) => {
        const currentGeneration=++generation;
        membershipUnsub?.();
        repo.session = null;
        if (!user) {
          callback(null);
          return;
        }
        // An invitation can be claimed once, only by its verified Google identity.
        try {
          await runTransaction(db,async tx=>{
            const target=doc(db,root,"members",user.uid),existing=await tx.get(target);
            if(existing.exists()||!user.email||!user.emailVerified||!user.providerData.some(p=>p.providerId==="google.com"))return;
            const inviteRef=doc(db,root,"invitations",user.email.toLowerCase()),invite=await tx.get(inviteRef),data=invite.data();
            if(!data?.active||data.claimedUid)return;
            tx.set(target,{name:data.name,email:data.email,role:data.role,active:true});
            tx.update(inviteRef,{claimedUid:user.uid,version:data.version+1,updatedAt:serverTimestamp(),updatedBy:user.uid});
          });
        } catch {
          if(currentGeneration!==generation)return;
          callback(null,"Não foi possível ativar seu convite. Confira com o administrador o e-mail da conta Google.");
          return;
        }
        if(currentGeneration!==generation)return;
        membershipUnsub = onSnapshot(
          doc(db, root, "members", user.uid),
          (snap) => {
            const profile = snap.data();
            if (
              !snap.exists() ||
              profile?.active !== true ||
              !["admin", "editor", "reader"].includes(profile?.role)
            ) {
              repo.session = null;
              callback(
                null,
                "Sua conta ainda não tem acesso ativo à equipe. Peça ao administrador para habilitá-la.",
              );
              return;
            }
            repo.session = {
              uid: user.uid,
              name: profile.name || user.email || "Equipe",
              email: user.email || "",
              role: profile.role,
            } as Session;
            callback(repo.session);
          },
          () => {
            repo.session = null;
            callback(null, "Não foi possível verificar o acesso da conta.");
          },
        );
      });
      return () => {
        generation++;
        unsub();
        membershipUnsub?.();
      };
    },
    async login(email, password) {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch {
        throw new Error("Não foi possível entrar. Confira o e-mail e a senha.");
      }
    },
    async loginGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        await signInWithRedirect(auth, provider);
      } catch {
        throw new Error("Não foi possível entrar com Google. Tente novamente com a conta habilitada.");
      }
    },
    async logout() {
      await signOut(auth);
    },
    subscribe(next, error) {
      let state: WorkspaceState = { operations: [], activities: [] };
      const received = new Set<string>();
      const publish = (collectionName: string) => {
        received.add(collectionName);
        // Avoid displaying a partially loaded checklist or institution list.
        if (received.size === 6) next(state);
      };
      const failed = () =>
        error(
          "Falha ao sincronizar. Confira sua conexão e as permissões da equipe.",
        );
      const a = onSnapshot(
        query(collection(db, root, "operations"), orderBy("updatedAt", "desc")),
        (snap) => {
          state = {
            ...state,
            operations: snap.docs.map((d) => {
              const v = d.data();
              return {
                ...v,
                id: d.id,
                createdAt: iso(v.createdAt),
                updatedAt: iso(v.updatedAt),
              } as Operation;
            }),
          };
          publish("operations");
        },
        failed,
      );
      const b = onSnapshot(
        query(
          collection(db, root, "activities"),
          orderBy("at", "desc"),
          limit(100),
        ),
        (snap) => {
          state = {
            ...state,
            activities: snap.docs.map(
              (d) =>
                ({ ...d.data(), id: d.id, at: iso(d.data().at) }) as Activity,
            ),
          };
          publish("activities");
        },
        failed,
      );
      const c = onSnapshot(
        collection(db, root, "directory"),
        (snap) => {
          const records = snap.docs.map((d) => {
            const v = d.data();
            return {
              ...v,
              id: d.id,
              createdAt: iso(v.createdAt),
              updatedAt: iso(v.updatedAt),
            } as DirectoryRecord;
          });
          state = {
            ...state,
            directory: { ...(state.directory ?? emptyDirectory), records },
          };
          publish("directory");
        },
        failed,
      );
      const d = onSnapshot(
        query(
          collection(db, root, "directoryEvents"),
          orderBy("at", "desc"),
          limit(200),
        ),
        (snap) => {
          state = {
            ...state,
            directory: {
              ...(state.directory ?? emptyDirectory),
              events: snap.docs.map(
                (d) =>
                  ({
                    ...d.data(),
                    id: d.id,
                    at: iso(d.data().at),
                  }) as DirectoryEvent,
              ),
            },
          };
          publish("directoryEvents");
        },
        failed,
      );
      const r = onSnapshot(
        collection(db, root, "records"),
        (snap) => {
          try {
            state = {
              ...state,
              records: snap.docs.map((d) => {
                const v = d.data();
                const input = validateRecord({
                  id: d.id,
                  kind: v.kind,
                  operationId: v.operationId,
                  data: JSON.parse(v.contentJson),
                });
                return {
                  ...input,
                  version: v.version,
                  createdAt: iso(v.createdAt),
                  updatedAt: iso(v.updatedAt),
                } as WorkspaceRecord;
              }),
            };
            publish("records");
          } catch {
            failed();
          }
        },
        failed,
      );
      const re = onSnapshot(
        query(
          collection(db, root, "recordEvents"),
          orderBy("at", "desc"),
          limit(400),
        ),
        (snap) => {
          state = {
            ...state,
            recordEvents: snap.docs.map(
              (d) =>
                ({
                  ...d.data(),
                  id: d.id,
                  at: iso(d.data().at),
                  changes: [],
                }) as unknown as RecordEvent,
            ),
          };
          publish("recordEvents");
        },
        failed,
      );
      return () => {
        a();
        b();
        c();
        d();
        r();
        re();
      };
    },
    async saveDirectory(raw, expectedVersion) {
      if (!auth.currentUser || !repo.session || repo.session.role === "reader")
        throw new Error("Você não tem permissão para alterar cadastros.");
      const input = validateDirectory(raw),
        target = doc(db, root, "directory", input.id),
        audit = doc(collection(db, root, "directoryEvents")),
        actor = repo.session;
      await runTransaction(db, async (tx) => {
        const current = await tx.get(target),
          old = current.exists() ? current.data() : null;
        if ((old?.version ?? null) !== expectedVersion)
          throw new Error(
            "Este cadastro mudou em outra sessão. Reabra antes de salvar.",
          );
        if (old && old.kind !== input.kind)
          throw new Error("Tipo de cadastro não pode ser alterado.");
        if (input.kind === "manager") {
          const bank = await tx.get(doc(db, root, "directory", input.bankId));
          if (bank.data()?.kind !== "bank")
            throw new Error("A instituição vinculada não existe.");
        }
        const version = (old?.version ?? 0) + 1;
        tx.set(target, {
          ...input,
          version,
          createdAt: old?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
          lastEventId: audit.id,
        });
        tx.set(audit, {
          entityId: input.id,
          kind: input.kind,
          name: input.name,
          actor: actor.name,
          actorUid: actor.uid,
          at: serverTimestamp(),
          version,
          changes: directoryChanges(old as DirectoryRecord | null, input),
        });
      });
    },
    async save(raw, expectedVersion) {
      if (!auth.currentUser || !repo.session || repo.session.role === "reader")
        throw new Error("Você não tem permissão para alterar operações.");
      const input = validateOperation(raw);
      const target = doc(db, root, "operations", input.id);
      const audit = doc(collection(db, root, "activities"));
      const actor = repo.session;
      await runTransaction(db, async (tx) => {
        const current = await tx.get(target);
        const old = current.exists() ? current.data() : null;
        if ((old?.version ?? null) !== expectedVersion)
          throw new Error(
            "Esta operação mudou em outra sessão. Feche e abra novamente antes de salvar.",
          );
        const next = {
          ...input,
          version: (old?.version ?? 0) + 1,
          createdAt: old?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
          lastEventId: audit.id,
        };
        tx.set(target, next);
        // Keep audit snapshots bounded and avoid copying unnecessary personal details.
        const view = (v: any) =>
          v
            ? {
                company: v.company,
                stage: v.stage,
                product: v.product,
                requestedCents: v.requestedCents,
                approvedCents: v.approvedCents,
                nextAction: v.nextAction,
                dueDate: v.dueDate,
                version: v.version,
              }
            : null;
        tx.set(audit, {
          operationId: input.id,
          company: input.company,
          actor: actor.name,
          actorUid: actor.uid,
          at: serverTimestamp(),
          action: old ? "Operação atualizada" : "Operação criada",
          before: view(old),
          after: view(next),
          operationVersion: next.version,
        });
      });
    },
  };
  return repo;
}
