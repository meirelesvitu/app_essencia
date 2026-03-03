import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolving correct path for .env file depending on where script is run
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = process.env.SUPABASE_ADMIN_INITIAL_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_PASSWORD) {
    console.error("ERRO: Certifique-se de configurar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ADMIN_INITIAL_PASSWORD no .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function provisionAdmin() {
    console.log(`Verificando se usuário ${ADMIN_EMAIL} já existe...`);

    // List users to check if our admin email exists
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();

    if (listErr) {
        console.error("Erro ao listar usuários:", listErr.message);
        process.exit(1);
    }

    const existingUser = users.find(u => u.email === ADMIN_EMAIL);
    let userId;

    if (existingUser) {
        console.log(`Usuário ${ADMIN_EMAIL} já existe. Atualizando senha...`);
        userId = existingUser.id;

        // Update password
        const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
            password: ADMIN_PASSWORD,
            email_confirm: true
        });

        if (updateErr) {
            console.error("Erro ao atualizar senha:", updateErr.message);
            process.exit(1);
        }
    } else {
        console.log(`Criando novo usuário ${ADMIN_EMAIL}...`);
        // Create new user
        const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true
        });

        if (createErr) {
            console.error("Erro ao criar usuário:", createErr.message);
            process.exit(1);
        }

        userId = userData.user.id;
    }

    console.log(`Garantindo que a role 'ADMIN' esteja definida na tabela profiles...`);

    // Update the profiles table to ensure role is ADMIN
    // We use upsert in case the trigger handle_new_user hasn't fired yet or to override it
    const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, role: 'ADMIN' }, { onConflict: 'id' });

    if (profileErr) {
        console.error("Erro ao definir role na tabela profiles:", profileErr.message);
        process.exit(1);
    }

    console.log("==================================================");
    console.log("✅ Administrador provisionado com sucesso!");
    console.log("Email: " + ADMIN_EMAIL);
    console.log("A senha foi definida de acordo com o .env (não logada).");
    console.log("AVISO: Certifique-se de NÃO commitar o arquivo .env contendo chaves ou senhas.");
    console.log("Para mudar a senha no futuro, utilize as funções de recovery de senha do Supabase.");
    console.log("==================================================");
}

provisionAdmin().catch(console.error);
