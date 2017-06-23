let __countLoop = [], jogadoresUsados = [], rodadaReferencia = 0;

const LIMITE_JOGADORES = 16;
const PONTUACAO_VITORIA = 3;
const LIMITE_GRUPOS = 4;
const LIMITE_NORMAL_POR_GRUPO = 4;
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

		// Recarregar dados
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
		for(let i = 0; i < numeroRodadas(grupos[index].length); i++) {
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

let numeroRodadas = (n) => {
	let referencia = {"4": 3, "5": 5};

	return referencia[n];
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

let atualizarDadosRodada = (rodadaAtual, callback) => {
	let confrontosFase1Ida = localStorage.getObj("confrontosFase1Ida"),
		confrontosFase1Volta = localStorage.getObj("confrontosFase1Volta"),
		grupos = localStorage.getObj("grupos"),
		confrontosAprocessar = [], gerouALteracao = false;

	for(let i in confrontosFase1Ida) {
		for(let j in confrontosFase1Ida[i]) {
			if(rodadaAtual === confrontosFase1Ida[i][j].rodada) {
				confrontosAprocessar.push({
					grupo: i,
					jogo: j,
					fase: "grupoIda",
					timeA: confrontosFase1Ida[i][j].casa.id,
					timeB: confrontosFase1Ida[i][j].fora.id
				});
			}
		}
	}

	for(let v in confrontosFase1Volta) {
		for(let z in confrontosFase1Volta[v]) {
			if(rodadaAtual === confrontosFase1Volta[v][z].rodada) {
				confrontosAprocessar.push({
					grupo: v,
					jogo: z,
					fase: "grupoVolta",
					timeA: confrontosFase1Volta[v][z].casa.id,
					timeB: confrontosFase1Volta[v][z].fora.id
				});
			}
		}
	}

	loop("atualizartimes", confrontosAprocessar, (confronto, next) => {
		let pontosTimeA = 0, pontosTimeB = 0, timePontuar = null;

		$.get(API_TIME_ID + confronto.timeA, (dadosA) => {
			pontosTimeA = dadosA.pontos ? dadosA.pontos : 0;

			$.get(API_TIME_ID + confronto.timeB, (dadosB) => {
				pontosTimeB = dadosB.pontos ? dadosB.pontos : 0;

				if(pontosTimeA > pontosTimeB) {
					timePontuar = confronto.timeA;

					gerouALteracao = true;
				} else if(pontosTimeB > pontosTimeA) {
					timePontuar = confronto.timeB;

					gerouALteracao = true;
				} else {
					next();
				}

				if(gerouALteracao && timePontuar) {
					if(confronto.fase === "grupoIda") {
						confrontosFase1Ida[confronto.grupo][confronto.jogo].vencedor = timePontuar;
						confrontosFase1Ida[confronto.grupo][confronto.jogo].casa.pontos = pontosTimeA;
						confrontosFase1Ida[confronto.grupo][confronto.jogo].fora.pontos = pontosTimeB;
					} else if(confronto.fase === "grupoVolta") {
						confrontosFase1Volta[confronto.grupo][confronto.jogo].vencedor = timePontuar;
						confrontosFase1Volta[confronto.grupo][confronto.jogo].casa.pontos = pontosTimeA;
						confrontosFase1Volta[confronto.grupo][confronto.jogo].fora.pontos = pontosTimeB;
					}
					
					if(confronto.fase === "grupoIda" || confronto.fase === "grupoVolta") {
						for(let k in grupos[confronto.grupo]) {
							if(grupos[confronto.grupo][k].time_id == timePontuar) {
								grupos[confronto.grupo][k].pontuacao = grupos[confronto.grupo][k].pontuacao + PONTUACAO_VITORIA;
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
					}
					
					// Segunda fase e outras somente atualizar confrontos
					next();
				}
			});
		});
	}, () => {
		if(gerouALteracao) {
			grupos.map((grupo) => {
				grupo.sort(sortByPontos);
			});

			localStorage.setObj("grupos", grupos);
			localStorage.setObj("confrontosFase1Ida", confrontosFase1Ida);
			localStorage.setObj("confrontosFase1Volta", confrontosFase1Volta);
			localStorage.setObj("rodadaAtualizacao", {
				rodada: rodadaAtual
			});
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
	let x = a.pontuacao;
	let y = b.pontuacao;

	return x < y ? 1 : x > y ? -1 : 0;
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
		ultimoJogoFase1Volta = confrontosFase1Volta[confrontosFase1Volta.length - 1][confrontosFase1Volta[0].length - 1];

	if (ultimoJogoFase1Volta.vencedor) {
		gerarOitavas(ultimoJogoFase1Volta);
	} else {
		mostrarMensagem("Ops! A primeira fase ainda n&#xE3;o acabou ;)");
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