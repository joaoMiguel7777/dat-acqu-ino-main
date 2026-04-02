// importa os bibliotecas necessários
const serialport = require("serialport");
const express = require("express");
const mysql = require("mysql2");

// constantes para configurações
const SERIAL_BAUD_RATE = 9600;
const SERVIDOR_PORTA = 3300;

// habilita ou desabilita a inserção de dados no banco de dados
const HABILITAR_OPERACAO_INSERIR = true;

// função para comunicação serial
const serial = async (
    valoresSensorAnalogico
) => {

    // conexão com o banco de dados MySQL
    let poolBancoDados = mysql.createPool(
        {
            host: 'localhost',
            user: 'root',
            password: '1234',
            database: 'monitoramentoBananAPI',
            port: 3306
        }
    ).promise();

    // lista as portas seriais disponíveis e procura pelo Arduino
    const portas = await serialport.SerialPort.list();
    const portaArduino = portas.find((porta) => porta.vendorId == 2341 && porta.productId == 43);
    if (!portaArduino) {
        throw new Error('O arduino não foi encontrado em nenhuma porta serial');
    }

    // configura a porta serial com o baud rate especificado
    const arduino = new serialport.SerialPort(
        {
            path: portaArduino.path,
            baudRate: SERIAL_BAUD_RATE
        }
    );

    // evento quando a porta serial é aberta
    arduino.on('open', () => {
        console.log(`A leitura do arduino foi iniciada na porta ${portaArduino.path} utilizando Baud Rate de ${SERIAL_BAUD_RATE}`);
    });

    // processa os dados recebidos do Arduino
    arduino.pipe(new serialport.ReadlineParser({ delimiter: '\r\n' })).on('data', async (data) => {
        console.log(data);
        const valores = data;
        const sensorAnalogico = parseFloat(valores);

        if (isNaN(sensorAnalogico)) {
            console.log("Dados invalidos, ignorando", data)
            return;
        }
        // armazena os valores dos sensores nos arrays correspondentes
        valoresSensorAnalogico.push(sensorAnalogico);

        // insere os dados no banco de dados (se habilitado)
        if (HABILITAR_OPERACAO_INSERIR) {
            try {
                // este insert irá inserir os dados na tabela "medida"
                await poolBancoDados.execute(
                    'INSERT INTO leitura (temperatura, fkSensor) VALUES (?, 1)',
                    [sensorAnalogico]
                );
                console.log("valores inseridos no banco: ", sensorAnalogico + ", " + "dia e horario");
            } catch (err) {
                console.error("Erro ao inserir no banco:", err.message)
            }

        }

    });

    // evento para lidar com erros na comunicação serial
    arduino.on('error', (mensagem) => {
        console.error(`Erro no arduino (Mensagem: ${mensagem})`)
        arduino.close()
    });
}

// função para criar e configurar o servidor web
const servidor = (valoresSensorAnalogico) => {
  const app = express();

  // configurações de requisição e resposta
  app.use((request, response, next) => {
    response.header("Access-Control-Allow-Origin", "*");
    response.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept",
    );
    next();
  });

  // inicia o servidor na porta especificada
  app.listen(SERVIDOR_PORTA, () => {
    console.log(`API executada com sucesso na porta ${SERVIDOR_PORTA}`);
  });

  // define os endpoints da API para cada tipo de sensor
  app.get("/sensores/analogico", (_, response) => {
    return response.json(valoresSensorAnalogico);
  });
};

// função principal assíncrona para iniciar a comunicação serial e o servidor web
(async () => {
    // arrays para armazenar os valores dos sensores
    const valoresSensorAnalogico = [];

    // inicia a comunicação serial
    await serial(
        valoresSensorAnalogico,
    );

    // inicia o servidor web
    servidor(
        valoresSensorAnalogico,
    );
})();

///////////////////////////////////////////////////

//teste sem arduino
// (async () => {
//   const valoresSensorAnalogico = [];

//   // conexão com o banco
//   let poolBancoDados = mysql
//     .createPool({
//       host: "localhost",
//       user: "root",
//       password: "h",
//       database: "teste",
//       port: 3306,
//     })
//     .promise();

//   // simulação no lugar do await serial()
//   setInterval(async () => {
//     const temperaturaFalsa = parseFloat((20 + Math.random() * 15).toFixed(2));
//     valoresSensorAnalogico.push(temperaturaFalsa);
//     console.log("Simulando temperatura:", temperaturaFalsa);

//     if (HABILITAR_OPERACAO_INSERIR) {
//       try {
//         await poolBancoDados.execute(
//           "INSERT INTO leitura (temperatura, fkSensor) VALUES (?, 1)",
//           [temperaturaFalsa],
//         );
//         console.log("Inserido no banco:", temperaturaFalsa);
//       } catch (err) {
//         console.error("Erro ao inserir no banco:", err.message);
//       }
//     }
//   }, 10000);

//   // inicia o servidor web
//   servidor(valoresSensorAnalogico);
// })();
