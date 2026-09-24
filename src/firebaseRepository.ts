import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
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
    session: null,
    authListener(callback) {
      const unsub = onAuthStateChanged(auth, (user) => {
        membershipUnsub?.();
        repo.session = null;
        if (!user) {
          callback(null);
          return;
        }
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
    async logout() {
      await signOut(auth);
    },
    subscribe(next, error) {
      let state: WorkspaceState = { operations: [], activities: [] };
      const failed = () =>
        error(
          "Falha ao sincronizar. Confira sua conexão e as permissões da equipe.",
        );
      const a = onSnapshot(
        query(
          collection(db, root, "operations"),
          orderBy("updatedAt", "desc"),
          limit(250),
        ),
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
          next(state);
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
          next(state);
        },
        failed,
      );
      return () => {
        a();
        b();
      };
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
