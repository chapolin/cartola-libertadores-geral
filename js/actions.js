let __countLoop = [], jogadoresUsados = [], rodadaReferencia = 0;

const LIMITE_JOGADORES = 16;
const PONTUACAO_VITORIA = 3;
const PONTUACAO_EMPATE = 1;
const LIMITE_GRUPOS = 4;
const LIMITE_NORMAL_POR_GRUPO = 4;
const NUMERO_RODADAS_GRUPO = 3;
const API_JOGADOR = "https://api.cartolafc.globo.com/times?q=";
const API_TIME_SLUG = "https://api.cartolafc.globo.com/time/slug/";
const API_TIME_ID = "https://api.cartolafc.globo.com/time/id/";
const API_DADOS_RODADA = "https://api.cartolafc.globo.com/mercado/status";
const API_TRINDADE_CARTOLA_SAVE = "http://138.197.21.33/api/cartola/save";
const API_TRINDADE_CARTOLA_CREATE_KEY = "http://138.197.21.33/api/cartola/createkey";

Storage.prototype.setObj = function(key, obj) {
	return this.setItem(key, JSON.stringify(obj));
};

Storage.prototype.getObj = function(key) {
	return JSON.parse(this.getItem(key));
};

let bindEventos = () => {
	$(".salvaJogadores").click(salvarDados);
	$(".logo").html(`<img src="${chrome.extension.getURL("images/logo.png")}" />`);
	$("#botaoSalvar").click(enviarDados);
	$("#botaoGerarOitavas").click(verificarSeGeraOitavas);
	$("#botaoGerarQuartas").click(verificarSeGeraQuartas);
};

let salvarDados = () => {
	$.ajax({
		method: 'POST',
		url: API_TRINDADE_CARTOLA_CREATE_KEY, 
		data: {email: $('input[name=emailAdmin]').val()},
		dataType: 'json',
		success: (data) => {
			if(data) {
				localStorage.setObj('admin', data);
			}

			cadastraJogadores();
		}, error: () => {
			mostrarMensagem('Erro ao salvar e-mail!!!');
		}
	});
};

let cadastraJogadores = () => {
	let arrayJogadores = $("input.jogadoresArray").val().split(","),
		jogadores = [], jogadoresInvalidos = [];

	if(arrayJogadores.length !== LIMITE_JOGADORES) {
		mostrarMensagem(`Voc&#xEA; precisa cadastrar exatamente ${LIMITE_JOGADORES} jogadores!`);
	} else {
		loop("cadastraJogadores", arrayJogadores, (jogador, next) => {
			jogador = $.trim(jogador);

			let url = API_TIME_SLUG + jogador;

			$.get(url, (dados) => {
				if(dados.time) {
					dados.time.pontuacao = 0;
					dados.time.pontosCartola = 0;

					jogadores.push(dados.time);
				} else {
					jogadoresInvalidos.push(jogador);
				}

				next();
			});
		}, () => {
			if(jogadores.length ===  LIMITE_JOGADORES) {
				construirListaJogadores(jogadores);
			} else {
				mostrarMensagem(`Os jogadores [ ${jogadoresInvalidos.join(", ")} ] n&#xE3;o foram encontrados!`);

				jogadoresInvalidos = [];
			}
		});
	}
};

let finalizarCadastro = (jogadores) => {
	localStorage.setObj("jogadores", jogadores);

	$.get(API_DADOS_RODADA, (dadosRodada) => {
		localStorage.setObj("rodadaDoCadastro", dadosRodada);

		gerarGrupos(jogadores);
	});
}

let gerarGrupos = (jogadores) => {
	let grupos = [];

	for(let i = 0; i < LIMITE_GRUPOS; i++) {
		grupos[i] = [];
	}
	
	let securityBlock = 0;

	loop("grupos", grupos, (grupo, next) => {
		while(grupo.length < LIMITE_NORMAL_POR_GRUPO) {
			if(securityBlock == 100) {
				break;
			}

			let random = pegarJogadorRandom();

			if(random !== -1 && jogadores && jogadores[random]) {
				grupo.push(jogadores[random]);
			}

			securityBlock++;
		}

		next();
	}, () => {
		let diff = (jogadores ? jogadores.length : 0) - jogadoresUsados.length;

		if(diff > 0 && diff <= LIMITE_GRUPOS) {
			for(let j = LIMITE_GRUPOS - 1; j >= diff; j--) {
				let random = pegarJogadorRandom();

				if(random !== -1 && jogadores[random]) {
					grupos[j].push(jogadores[random]);
				}
			}
 		}
		
		localStorage.setObj("grupos", grupos);

		gerarConfrontosIda();
		gerarConfrontosVolta();

		history.go(0);
	});
};

let gerarConfrontosIda = () => {
	let grupos = localStorage.getObj("grupos"), 
		rodada = localStorage.getObj("rodadaDoCadastro"), confrontosFase1 = [], 
		arrayControle = {}, rodadaContador = rodada.rodada_atual + 1;

	for(let i in grupos) {
		let copyGrupoItens = grupos[i].slice();

		for(let j in grupos[i]) {
			let casa = grupos[i][j];

			for(let k = 0; k < copyGrupoItens.length; k++) {
				let nextIndex = parseInt(k) + 1;

				if(copyGrupoItens[ nextIndex ]) {
					let fora = copyGrupoItens[nextIndex];

					if(!confrontosFase1[i]) {
						confrontosFase1[i] = [];
					}

					if(confrontosFase1[i][confrontosFase1[i].length - 1] && confrontosFase1[i][confrontosFase1[i].length - 1].casa.id == casa.time_id || 
						confrontosFase1[i][confrontosFase1[i].length - 1] && confrontosFase1[i][confrontosFase1[i].length - 1].fora.id == fora.time_id) {
					}

					confrontosFase1[i].push({
						vencedor: null,
						casa: {
							id: casa.time_id,
							nome: casa.nome,
							escudo: casa.url_escudo_svg,
						},
						fora: {
							id: fora.time_id,
							nome: fora.nome,
							escudo: fora.url_escudo_svg
						}
					});
				}
			}

			copyGrupoItens.shift();
		}

		definirRodadas(confrontosFase1, i, rodadaContador);

		if(rodadaContador > rodadaReferencia) {
			rodadaReferencia = rodadaContador;
		}

    rodadaContador = rodada.rodada_atual + 1;
	}

	localStorage.setObj("confrontosFase1Ida", confrontosFase1);
};

let pegarRodadaUltimoJogo = () => {
	let confrontos = localStorage.getObj("confrontosFase1Ida");

	return confrontos[confrontos.length - 1][confrontos[confrontos.length - 1].length - 1].rodada + 1;
};

let gerarConfrontosVolta = () => {
	let grupos = localStorage.getObj("grupos"), 
		rodadaContador = pegarRodadaUltimoJogo(),
		confrontosFase1 = [], arrayControle = {};

	for(let i in grupos) {
		let copyGrupoItens = grupos[i].slice(), copyGrupoItens2 = grupos[i].slice();

		copyGrupoItens.reverse();
		copyGrupoItens2.reverse();

		for(let j in copyGrupoItens2) {
			let casa = copyGrupoItens2[j];

			for(let k = 0; k < copyGrupoItens.length; k++) {
				let nextIndex = parseInt(k) + 1;

				if(copyGrupoItens[ nextIndex ]) {
					let fora = copyGrupoItens[nextIndex];

					if(!confrontosFase1[i]) {
						confrontosFase1[i] = [];
					}

					if(confrontosFase1[i][confrontosFase1[i].length - 1] && confrontosFase1[i][confrontosFase1[i].length - 1].casa.id == casa.time_id || 
						confrontosFase1[i][confrontosFase1[i].length - 1] && confrontosFase1[i][confrontosFase1[i].length - 1].fora.id == fora.time_id) {
					}

					confrontosFase1[i].push({
						vencedor: null,
						casa: {
							id: casa.time_id,
							nome: casa.nome,
							escudo: casa.url_escudo_svg,
						},
						fora: {
							id: fora.time_id,
							nome: fora.nome,
							escudo: fora.url_escudo_svg
						}
					});
				}
			}

			copyGrupoItens.shift();
		}

		definirRodadas(confrontosFase1, i, rodadaContador);

		rodadaContador = pegarRodadaUltimoJogo();
	}

	localStorage.setObj("confrontosFase1Volta", confrontosFase1);
};

let definirRodadas = (confrontos, index, rodadaContador) => {
	let grupos = localStorage.getObj("grupos"), arrayControleRodada = {};

	confrontos[index].map((confronto, indice, array) => {
		for(let i = 0; i < NUMERO_RODADAS_GRUPO; i++) {
			if(!arrayControleRodada[i]) {
				arrayControleRodada[i] = [];
			}

			if(!confronto.rodada && $.inArray(confronto.casa.id, arrayControleRodada[i]) == -1 && $.inArray(confronto.fora.id, arrayControleRodada[i]) == -1) {
				arrayControleRodada[i].push(confronto.casa.id);
				arrayControleRodada[i].push(confronto.fora.id);

				confronto.rodada = rodadaContador + i;

				break;
			}
		}
	});

	confrontos[index].sort(sortByRodada);
};

let pegarJogadorRandom = () => {
	if(jogadoresUsados.length === LIMITE_JOGADORES) {
		return -1;
	}

	let value = Math.floor(Math.random() * LIMITE_JOGADORES);

	if($.inArray(value, jogadoresUsados) == -1) {
		jogadoresUsados.push(value);

		return value;
	} else {
		return pegarJogadorRandom();
	}
};

let refazerCadastro = () => {
	$(".jogadoresArray").val("");
	$("#placeHolder").html("");
};

let mostrarMensagem = (mensagem, timeout = 5000, sucesso = false) => {
	$("#mensagens").show();
	$("#mensagens").html(mensagem);

	$("#mensagens").css("opacity", "1");

	if(sucesso) {
		$("#mensagens").css("background", "#559e5e");
	} else {
		$("#mensagens").css("background", "#FF0000");
	}

	setTimeout(() => {
			$(`#mensagens`).css("opacity", "0");
			$("#mensagens").html("");
	}, 5000);
};

let montarHtml = () => {
	montarDadosRodada(() => {
		montarTabelaJogos();
	});
};

let confrontosGrupos = (array, confrontos, rodada, fase) => {
	for(let grupo in confrontos) {
		for(let jogo in confrontos[grupo]) {
			if(rodada === confrontos[grupo][jogo].rodada) {
				array.push({ grupo, jogo, fase, timeA: confrontos[grupo][jogo].casa.id, timeB: confrontos[grupo][jogo].fora.id });
			}
		}
	}
};

let confrontosFinais = (array, confrontos, rodada, fase) => {
	for(let jogo in confrontos) {
		if(rodada === confrontos[jogo].rodada) {
			array.push({ jogo, fase, timeA: confrontos[jogo].casa.id, timeB: confrontos[jogo].fora.id });
		}
	}
};

let adicionarInfoAoConfronto = (array, jogo, vencedor, ptsA, ptsB) => {
	array[jogo].vencedor = vencedor;
	array[jogo].casa.pontos = ptsA;
	array[jogo].fora.pontos = ptsB;
};

let atualizarDadosRodada = (rodada, callback) => {
	let grupos = localStorage.getObj("grupos"),
		confrontosFase1Ida = localStorage.getObj("confrontosFase1Ida"),
		confrontosFase1Volta = localStorage.getObj("confrontosFase1Volta"),
		confrontosOitavasIda = localStorage.getObj("confrontosOitavasIda"),
		confrontosOitavasVolta = localStorage.getObj("confrontosOitavasVolta"),
		confrontosQuartasIda = localStorage.getObj("confrontosQuartasIda"),
		confrontosQuartasVolta = localStorage.getObj("confrontosQuartasVolta"),
		toleranciaEmpate = localStorage.getObj("toleranciaEmpate") || 0,
		confrontos = [], gerouAlteracaoGrupo = false, gerouAlteracaoFinais = false;

	confrontosGrupos(confrontos, confrontosFase1Ida, rodada, "grupoIda");
	confrontosGrupos(confrontos, confrontosFase1Volta, rodada, "grupoVolta");
	confrontosFinais(confrontos, confrontosOitavasIda, rodada, "oitavasIda");
	confrontosFinais(confrontos, confrontosOitavasVolta, rodada, "oitavasVolta");
	confrontosFinais(confrontos, confrontosQuartasIda, rodada, "quartasIda");
	confrontosFinais(confrontos, confrontosQuartasVolta, rodada, "quartasVolta");

	loop("atualizartimes", confrontos, (confronto, next) => {
		let pontosTimeA = 0, pontosTimeB = 0, timePontuar = null;

		$.get(API_TIME_ID + confronto.timeA, (dadosA) => {
			pontosTimeA = dadosA.pontos ? dadosA.pontos : 0;

			$.get(API_TIME_ID + confronto.timeB, (dadosB) => {
				pontosTimeB = dadosB.pontos ? dadosB.pontos : 0;

				if(pontosTimeA - toleranciaEmpate > pontosTimeB) {
					timePontuar = confronto.timeA;
				} else if(pontosTimeB - toleranciaEmpate > pontosTimeA) {
					timePontuar = confronto.timeB;
				} else {
					timePontuar = 1;
				}

				if(timePontuar && (confronto.fase === "grupoIda" || confronto.fase === "grupoVolta")) {
					gerouAlteracaoGrupo = true;

					if(confronto.fase === "grupoIda") {
						adicionarInfoAoConfronto(confrontosFase1Ida[confronto.grupo], confronto.jogo, timePontuar, pontosTimeA, pontosTimeB);
					} else if(confronto.fase === "grupoVolta") {
						adicionarInfoAoConfronto(confrontosFase1Volta[confronto.grupo], confronto.jogo, timePontuar, pontosTimeA, pontosTimeB);
					}
					
					for(let k in grupos[confronto.grupo]) {
						if(grupos[confronto.grupo][k].time_id == timePontuar) {
							grupos[confronto.grupo][k].pontuacao = grupos[confronto.grupo][k].pontuacao + PONTUACAO_VITORIA;
						} else if((grupos[confronto.grupo][k].time_id == confronto.timeA || grupos[confronto.grupo][k].time_id == confronto.timeB) && timePontuar == 1) {
							grupos[confronto.grupo][k].pontuacao = grupos[confronto.grupo][k].pontuacao + PONTUACAO_EMPATE;
						}

						if(!grupos[confronto.grupo][k].pontosCartola) {
							grupos[confronto.grupo][k].pontosCartola = 0;
						}

						if(grupos[confronto.grupo][k].time_id == confronto.timeA) {
							grupos[confronto.grupo][k].pontosCartola = grupos[confronto.grupo][k].pontosCartola + pontosTimeA;
						} else if(grupos[confronto.grupo][k].time_id == confronto.timeB) {
							grupos[confronto.grupo][k].pontosCartola = grupos[confronto.grupo][k].pontosCartola + pontosTimeB;
						}
					}
				} else if(timePontuar && (confronto.fase === "oitavasIda" || confronto.fase === "oitavasVolta" || confronto.fase === "quartasIda" || confronto.fase === "quartasVolta")) {
					gerouAlteracaoFinais = true;

					if(confronto.fase === "oitavasIda") {
						adicionarInfoAoConfronto(confrontosOitavasIda, confronto.jogo, timePontuar, pontosTimeA, pontosTimeB);
					} else if(confronto.fase === "oitavasVolta") {
						adicionarInfoAoConfronto(confrontosOitavasVolta, confronto.jogo, timePontuar, pontosTimeA, pontosTimeB);
					} else if(confronto.fase === "quartasIda") {
						adicionarInfoAoConfronto(confrontosQuartasIda, confronto.jogo, timePontuar, pontosTimeA, pontosTimeB);
					} else if(confronto.fase === "quartasVolta") {
						adicionarInfoAoConfronto(confrontosQuartasVolta, confronto.jogo, timePontuar, pontosTimeA, pontosTimeB);
					}
				}

				next();
			});
		});
	}, () => {
		if(gerouAlteracaoGrupo) {
			grupos.map((grupo) => {
				grupo.sort(sortByPontos);
			});

			localStorage.setObj("grupos", grupos);
			localStorage.setObj("confrontosFase1Ida", confrontosFase1Ida);
			localStorage.setObj("confrontosFase1Volta", confrontosFase1Volta);
		} else if(gerouAlteracaoFinais) {
			localStorage.setObj("confrontosOitavasIda", confrontosOitavasIda);
			localStorage.setObj("confrontosOitavasVolta", confrontosOitavasVolta);

			localStorage.setObj("confrontosQuartasIda", confrontosQuartasIda);
			localStorage.setObj("confrontosQuartasVolta", confrontosQuartasVolta);
		}

		if(gerouAlteracaoGrupo || gerouAlteracaoFinais) {
			localStorage.setObj("rodadaAtualizacao", { rodada });
		}

		callback();
	});
};

let loop = function(name, array, callback, finalCallback) {
	if(!__countLoop[name]) {
		__countLoop[name] = 0;
	}
	
	if(__countLoop[name] < array.length) {
		callback(array[ __countLoop[name] ], () => {
			__countLoop[name]++;
			
			loop(name, array, callback, finalCallback);
		});
	} else {
		__countLoop[name] = 0;
		
		if(finalCallback) {
			finalCallback();
		}
	}
};

let ajustaDataNumero = (number, plusOne) => {
	if(plusOne === true) {
		number++;
	}
	
	return (number <= 9 ? "0" : "") + number;
};

let statusMercado = (status) => {
	switch(status) {
		case 1: 
			return "Aberto";
		case 2: 
			return "Fechado";
		case 3: 
			return "Em atualiza&#xE7;&#xE3;o";
		case 4: 
			return "Em manuten&#xE7;&#xE3;o";
		default: 
			return "N/D";
	}
};

let sortByRodada = (a, b) => {
	let x = a.rodada;
	let y = b.rodada;

	return x < y ? -1 : x > y ? 1 : 0;
};

let sortByPontos = (a, b) => {
  if(a.pontuacao > b.pontuacao) return -1;
  if(a.pontuacao < b.pontuacao) return 1;
  if(a.pontosCartola > b.pontosCartola) return -1;
  if(a.pontosCartola < b.pontosCartola) return 1;
};

let sortByPontosCartola = (a, b) => {
  if(a.pontos > b.pontos) return -1;
  if(a.pontos < b.pontos) return 1;
};

let mostrarJogos = (destino1, destino2, indice = null) => {
	indiceObjeto = indice ? '-' + indice : '';

	if($(`.${destino1}${indiceObjeto}`).is(':visible')) {
		$(`.${destino1}${indiceObjeto}`).hide();
		$(`.${destino1}-titulo${indiceObjeto}`).hide();

		$(`.${destino2}${indiceObjeto}`).show();
		$(`.${destino2}-titulo${indiceObjeto}`).show();
	} else {
		$(`.${destino2}${indiceObjeto}`).hide();
		$(`.${destino2}-titulo${indiceObjeto}`).hide();

		$(`.${destino1}${indiceObjeto}`).show();
		$(`.${destino1}-titulo${indiceObjeto}`).show();
	}
};

let enviarDados = () => {
	let objeto = {},
	grupos = localStorage.getObj("grupos"),
	confrontosFase1Ida = localStorage.getObj("confrontosFase1Ida"),
	confrontosFase1Volta = localStorage.getObj("confrontosFase1Volta"),
	confrontosOitavasIda = localStorage.getObj("confrontosOitavasIda"),
	confrontosOitavasVolta = localStorage.getObj("confrontosOitavasVolta"),
	confrontosQuartasIda = localStorage.getObj("confrontosQuartasIda"),
	confrontosQuartasVolta = localStorage.getObj("confrontosQuartasVolta"),
	admin = localStorage.getObj("admin");

	if(admin && admin._id) {
		objeto["key"] = admin._id;
	}

	if(grupos) {
		objeto["grupos"] = grupos;
	}
	
	if(confrontosFase1Ida) {
		objeto["confrontosFase1Ida"] = confrontosFase1Ida;
	}
	
	if(confrontosFase1Volta) {
		objeto["confrontosFase1Volta"] = confrontosFase1Volta;
	}

	if(confrontosOitavasIda) {
		objeto["confrontosOitavasIda"] = confrontosOitavasIda;
	}
	
	if(confrontosOitavasVolta) {
		objeto["confrontosOitavasVolta"] = confrontosOitavasVolta;
	}

	if(confrontosQuartasIda) {
		objeto["confrontosQuartasIda"] = confrontosQuartasIda;
	}
	
	if(confrontosQuartasVolta) {
		objeto["confrontosQuartasVolta"] = confrontosQuartasVolta;
	}

	$.ajax({
		beforeSend: function(request) {
			request.setRequestHeader("Content-Type","application/json");
		},
		method: "POST",
		url: API_TRINDADE_CARTOLA_SAVE, 
		data: JSON.stringify(objeto),
		dataType: "json",
		success: (data) => {
			mostrarMensagem("Dados salvos com sucesso!!!", 5000, true);
		}, error: (error) => {
			mostrarMensagem("Erro ao salvar dados!!!");
		}
	});
};

let verificarSeGeraOitavas = () => {
	const confrontosFase1Volta = localStorage.getObj("confrontosFase1Volta"),
		confrontosOitavasVolta = localStorage.getObj("confrontosOitavasVolta"),
		ultimoJogoFase1Volta = confrontosFase1Volta[confrontosFase1Volta.length - 1][confrontosFase1Volta[0].length - 1];

	if(confrontosOitavasVolta) {
		mostrarMensagem("Oitavas de final j&#xE1; foram geradas ;)");
	} else if (ultimoJogoFase1Volta.vencedor) {
		gerarOitavas(ultimoJogoFase1Volta);
	} else {
		mostrarMensagem("Ops! A primeira fase ainda n&#xE3;o acabou ;)");
	}
};

let verificarSeGeraQuartas = () => {
	const confrontosOitavasVolta = localStorage.getObj("confrontosOitavasVolta"),
		confrontosQuartasVolta = localStorage.getObj("confrontosQuartasVolta"),
		ultimoJogoOitavasVolta = confrontosOitavasVolta[confrontosOitavasVolta.length - 1];

	if(confrontosQuartasVolta) {
		mostrarMensagem("Quartas de final j&#xE1; foram geradas ;)");
	} else if (ultimoJogoOitavasVolta.vencedor) {
		gerarQuartas(ultimoJogoOitavasVolta);
	} else {
		mostrarMensagem("Ops! As oitavas de final ainda n&#xE3;o acabou ;)");
	}
};

let gerarOitavas = (ultimoConfronto) => {
	let rodada = ultimoConfronto.rodada, grupos = localStorage.getObj("grupos"), 
		classificados = [], confrontosOitavasIda = [], confrontosOitavasVolta = [];
	
	for(let i in grupos) {
		let count = 1;

		for(let j in grupos[i]) {
			classificados.push(grupos[i][j]);

			if(count%2 == 0) {
				break;
			}

			count++;
		}
	}

	rodada++;

	// Oitavas Ida
	confrontosOitavasIda.push(criarJogo(classificados[0], classificados[7], rodada));
	confrontosOitavasIda.push(criarJogo(classificados[1], classificados[6], rodada));
	confrontosOitavasIda.push(criarJogo(classificados[2], classificados[5], rodada));
	confrontosOitavasIda.push(criarJogo(classificados[3], classificados[4], rodada));

	rodada++;

	// Oitavas Volta
	confrontosOitavasVolta.push(criarJogo(classificados[7], classificados[0], rodada));
	confrontosOitavasVolta.push(criarJogo(classificados[6], classificados[1], rodada));
	confrontosOitavasVolta.push(criarJogo(classificados[5], classificados[2], rodada));
	confrontosOitavasVolta.push(criarJogo(classificados[4], classificados[3], rodada));

	localStorage.setObj("confrontosOitavasIda", confrontosOitavasIda);
	localStorage.setObj("confrontosOitavasVolta", confrontosOitavasVolta);

	mostrarMensagem("Oitavas de final gerada com sucesso!", 5000, true);
};

let gerarQuartas = (ultimoConfronto) => {
	let rodada = ultimoConfronto.rodada;

	const resultados = [], resultadosArr = [],
		confrontosOitavasIda = localStorage.getObj("confrontosOitavasIda"),
		confrontosOitavasVolta = localStorage.getObj("confrontosOitavasVolta"),
		confrontosQuartasIda = [], confrontosQuartasVolta = [];

	let contador = 0;

	for(const i in confrontosOitavasIda) {
		const timeCasa = confrontosOitavasIda[i].casa,
			timeFora = confrontosOitavasIda[i].fora,
			vencedor = confrontosOitavasIda[i].vencedor;

		if(!resultados[contador]) {
			resultados[contador] = {};

			resultados[contador][timeCasa.id] = { vitorias: 0, pontos: 0 };
			resultados[contador][timeFora.id] = { vitorias: 0, pontos: 0 };
		}

		if(vencedor === timeCasa.id) {
			resultados[contador][timeCasa.id].vitorias++;
		} else if(vencedor === timeFora.id) {
			resultados[contador][timeFora.id].vitorias++;
		}

		resultados[contador][timeCasa.id].pontos+= timeCasa.pontos;
		resultados[contador][timeFora.id].pontos+= timeFora.pontos;

		contador++;
	}

	contador = 0;

	for(const j in confrontosOitavasVolta) {
		const timeCasa = confrontosOitavasVolta[j].casa,
			timeFora = confrontosOitavasVolta[j].fora,
			vencedor = confrontosOitavasVolta[j].vencedor;

		if(vencedor === timeCasa.id) {
			resultados[contador][timeCasa.id].vitorias++;
		} else if(vencedor === timeFora.id) {
			resultados[contador][timeFora.id].vitorias++;
		}

		resultados[contador][timeCasa.id].pontos+= timeCasa.pontos;
		resultados[contador][timeFora.id].pontos+= timeFora.pontos;

		contador++;
	}

	const classificado1 = buscaGanhadorConfrontos(resultados[0]),
		classificado2 = buscaGanhadorConfrontos(resultados[3]),
		classificado3 = buscaGanhadorConfrontos(resultados[1]),
		classificado4 = buscaGanhadorConfrontos(resultados[2]);

	rodada++;

	// Quartas Ida
	confrontosQuartasIda.push(criarJogo(classificado1, classificado2, rodada));
	confrontosQuartasIda.push(criarJogo(classificado3, classificado4, rodada));

	rodada++;

	// Quartas Volta
	confrontosQuartasVolta.push(criarJogo(classificado2, classificado1, rodada));
	confrontosQuartasVolta.push(criarJogo(classificado4, classificado3, rodada));

	localStorage.setObj("confrontosQuartasIda", confrontosQuartasIda);
	localStorage.setObj("confrontosQuartasVolta", confrontosQuartasVolta);

	mostrarMensagem("Quartas de final gerada com sucesso!", 5000, true);
};

let buscaTimeById = (id) => {
	const times = localStorage.getObj("jogadores");

	for(const time in times) {
		if(times[time].time_id == id) {
			
			return times[time];
		}
	}
};

const buscaGanhadorConfrontos = (resultado) => {
	const times = [], vencedor = {};

	for(const id in resultado) {
		times.push({ id, vitorias: resultado[id].vitorias, pontos: resultado[id].pontos });
	}

	times.sort(sortByPontosCartola);

	if(times[0].vitorias >= times[1].vitorias) {
		return buscaTimeById(times[0].id);
	} else if(times[0].vitorias < times[1].vitorias){
		return buscaTimeById(times[1].id);
	}
};

let criarJogo = (casa, fora, rodada = null) => {
	let jogo = {
		vencedor: null,
		casa: {
			id: casa.time_id,
			nome: casa.nome,
			escudo: casa.url_escudo_svg,
		},
		fora: {
			id: fora.time_id,
			nome: fora.nome,
			escudo: fora.url_escudo_svg
		}
	};

	if(rodada) {
		jogo.rodada = rodada;
	}

	return jogo;
};