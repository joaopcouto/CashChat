import 'dotenv/config';
import { connectToDatabase } from './src/config/database.js';
import { processInstallments } from './src/jobs/installmentProcessorJob.js';

(async () => {
  console.log('--- INICIANDO EXECUÇÃO MANUAL DO JOB ---');
  
  try {
    console.log('Conectando ao banco de dados...');
    await connectToDatabase();
    console.log('✅ Conectado!');

    console.log('\n▶️ Executando a função processInstallments() agora...\n');
    
    await processInstallments();

    console.log('\n✅ Execução manual do job concluída.');
  } catch (error) {
    console.error('❌ Erro durante a execução manual:', error);
  } finally {
    console.log('--- FIM DA EXECUÇÃO MANUAL ---');
    process.exit(0);
  }
})();

//comnando para rodar o teste -> node runJobManually.js