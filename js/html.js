let construirListaJogadores = (jogadores) => {
	$("#placeHolder").html("<ul class=\"listaJogadores\"></ul>");

	for(let i in jogadores) {
		$("#placeHolder ul").append(`<li><strong>${jogadores[i].nome}</strong> (<em> ${jogadores[i].nome_cartola} </em>)</li>`);
	}

	$("#placeHolder").append("<input type=\"button\" class=\"botaoFinalizarCadastro\" value=\"Todos os times est&#xE3;o corretos?\" />");
	$("#placeHolder").append("<input type=\"button\" class=\"botaoRefazer\" value=\"Refazer\" />");

	$(".botaoRefazer").click(refazerCadastro);
	$(".botaoFinalizarCadastro").click(() => {
		finalizarCadastro(jogadores);
	});
};

let montarDadosRodada = (callback) => {
	let grupos = localStorage.getObj("grupos");

	if(grupos) {
		let admin = localStorage.getObj('admin');
		
		$.get(API_DADOS_RODADA, (rodada) => {
			$("#placeHolder").append("<h1>Dados Rodada</h1>");
			$("#placeHolder").append(
				`
					<h2>Rodada atual: ${rodada.rodada_atual}</h2>
					<p><strong>Status mercado:</strong> ${statusMercado(rodada.status_mercado)}</p>
				`
			);

			if(rodada.status_mercado == 1) {
				$("#placeHolder").append(
					`
					<p>
							<strong>Hora do fechamento:</strong>
							<em> ${ajustaDataNumero(rodada.fechamento.dia)}.${ajustaDataNumero(rodada.fechamento.mes)}.${rodada.fechamento.ano} &#xE0;s ${ajustaDataNumero(rodada.fechamento.hora)}:${ajustaDataNumero(rodada.fechamento.minuto)}</em>
						</p>
					`
				);
			} else if(rodada.status_mercado == 4) {
				// Ou status == 2?
				$("#placeHolder").append(
					`
					<p>
							<strong>Mercado fecha em:</strong>
							<em> ${ajustaDataNumero(rodada.fechamento.dia)}.${ajustaDataNumero(rodada.fechamento.mes)}.${rodada.fechamento.ano} &#xE0;s ${ajustaDataNumero(rodada.fechamento.hora)}:${ajustaDataNumero(rodada.fechamento.minuto)}</em>
						</p>
					`
				);
			}

			if(rodada.status_mercado == 1) {
				let rodadaAtualizacao = localStorage.getObj("rodadaAtualizacao");

				if(!rodadaAtualizacao || rodada.rodada_atual > rodadaAtualizacao.rodada) {
					atualizarDadosRodada(rodada.rodada_atual, callback);
				} else {
					callback();
				}
			} else {
				callback();
			}

			$('.clienteChave').html(admin._id);
		});
	} else {
		$("#formJogadores").show();
	}
};

let montarTabelaJogos = () => {
	let grupos = localStorage.getObj("grupos"), 
    confrontosFase1Ida = localStorage.getObj("confrontosFase1Ida"),
		confrontosFase1Volta = localStorage.getObj("confrontosFase1Volta"),
    confrontosOitavasIda = localStorage.getObj("confrontosOitavasIda"),
    confrontosOitavasVolta = localStorage.getObj("confrontosOitavasVolta");

  if(grupos) {
		for(let i in grupos) {
			let indice = parseInt(i) + 1;

			$("#placeHolder").append(`<h2 class="grupo-label"># GRUPO ${indice}</h2>`);
			$("#placeHolder").append(`
				<table id="grupo_${indice}" class=\"grupoItens\">
					<tbody>
					<tr>
						<th class="left">Jogador</td>
						<th class="left">Time</td>
						<th>P. Cartola</td>
						<th>Pontos</td>
					</tr>
					</tbody>
				</table>
			`);

			for(let j in grupos[i]) {
				$(`#placeHolder table#grupo_${indice}`).append(`
					<tr>
						<td>${grupos[i][j].nome_cartola}</td>
						<td>${grupos[i][j].nome}</td>
						<td>${grupos[i][j].pontosCartola ? grupos[i][j].pontosCartola.toFixed(2) : 0}</td>
						<td class="pontosGrupo">${grupos[i][j].pontuacao}</td>
					</tr>
				`);
			}

			if(confrontosFase1Ida) {
				$("#placeHolder").append(`<h2 class="jogos-label jogos-ida-titulo jogos-ida-titulo-${indice}" data-indice="${indice}"># JOGOS DE IDA</h2>`);
				$("#placeHolder").append(`<table id="jogos_ida_grupo_${indice}" class=\"grupoJogosItens jogos-ida jogos-ida-${indice}\"></table>`);

				let contador = 1;

				for(let k in confrontosFase1Ida[i]) {
					let casa = confrontosFase1Ida[i][k].casa,
						fora = confrontosFase1Ida[i][k].fora;

					$(`#placeHolder table#jogos_ida_grupo_${indice}`).append(
						`<tr${contador%2 == 0 ? " class=\"corNao\"": ""}>
							<td class="colRodada">#${confrontosFase1Ida[i][k].rodada - 1}</td>
							<td class="colNomeCasa${confrontosFase1Ida[i][k].vencedor == casa.id ? " vencedorCasa" : ""}">${casa.nome}${casa.pontos ? "<span class=\"pontosCasa\">( " + casa.pontos.toFixed(2) + " )": ""}</td>
							<td class="colImagemCasa"><img src="${casa.escudo}" width="35" /></td>
							<td class="colVs"><img src="${chrome.extension.getURL("images/vs-" + (contador%2) + ".jpg")}" width="20" /></td>
							<td class="colImagemFora"><img src="${fora.escudo}" width="35" /></td>
							<td class="colNomeFora${confrontosFase1Ida[i][k].vencedor == fora.id ? " vencedorFora" : ""}">${fora.nome}${fora.pontos ? "<span class=\"pontosFora\">( " + fora.pontos.toFixed(2) + " )": ""}</td>
						</tr>`
					);

					contador++;
				}
			}

			if(confrontosFase1Volta) {
				$("#placeHolder").append(`<h2 class="jogos-label jogos-volta-titulo jogos-volta-titulo-${indice}" data-indice="${indice}"># JOGOS DE VOLTA</h2>`);
				$("#placeHolder").append(`<table id="jogos_volta_grupo_${indice}" class=\"grupoJogosItens jogos-volta jogos-volta-${indice}\"></table>`);

				let contador = 1;

				for(let k in confrontosFase1Volta[i]) {
					let casa = confrontosFase1Volta[i][k].casa,
						fora = confrontosFase1Volta[i][k].fora;
					$(`#placeHolder table#jogos_volta_grupo_${indice}`).append(
						`<tr${contador%2 == 0 ? " class=\"corNao\"": ""}>
							<td class="colRodada">#${confrontosFase1Volta[i][k].rodada - 1}</td>
							<td class="colNomeCasa${confrontosFase1Volta[i][k].vencedor == casa.id ? " vencedorCasa" : ""}">${casa.nome}${casa.pontos ? "<span class=\"pontosCasa\">( " + casa.pontos.toFixed(2) + " )": ""}</td>
							<td class="colImagemCasa"><img src="${casa.escudo}" width="35" /></td>
							<td class="colVs"><img src="${chrome.extension.getURL("images/vs-" + (contador%2) + ".jpg")}" width="20" /></td>
							<td class="colImagemFora"><img src="${fora.escudo}" width="35" /></td>
							<td class="colNomeFora${confrontosFase1Volta[i][k].vencedor == fora.id ? " vencedorFora" : ""}">${fora.nome}${fora.pontos ? "<span class=\"pontosFora\">( " + fora.pontos.toFixed(2) + " )": ""}</td>
						</tr>`
					);

					contador++;
				}
			}
		}
	}

  if(confrontosOitavasIda) {
  	$("#placeHolder").append(`<h2 class="jogos-label jogos-oitavas-ida-titulo"># OITAVAS DE FINAL [ IDA ]</h2>`);
    $("#placeHolder").append(`<table class=\"grupoJogosItens jogos-oitavas-ida\"></table>`);

    let contador = 1;

    for(let i in confrontosOitavasIda) {
      let casa = confrontosOitavasIda[i].casa,
        fora = confrontosOitavasIda[i].fora;
      $(`#placeHolder table.jogos-oitavas-ida`).append(
        `<tr${contador%2 == 0 ? " class=\"corNao\"": ""}>
          <td class="colRodada">#${confrontosOitavasIda[i].rodada - 1}</td>
          <td class="colNomeCasa${confrontosOitavasIda[i].vencedor == casa.id ? " vencedorCasa" : ""}">${casa.nome}${casa.pontos ? "<span class=\"pontosCasa\">( " + casa.pontos.toFixed(2) + " )": ""}</td>
          <td class="colImagemCasa"><img src="${casa.escudo}" width="35" /></td>
          <td class="colVs"><img src="${chrome.extension.getURL("images/vs-" + (contador%2) + ".jpg")}" width="20" /></td>
          <td class="colImagemFora"><img src="${fora.escudo}" width="35" /></td>
          <td class="colNomeFora${confrontosOitavasIda[i].vencedor == fora.id ? " vencedorFora" : ""}">${fora.nome}${fora.pontos ? "<span class=\"pontosFora\">( " + fora.pontos.toFixed(2) + " )": ""}</td>
        </tr>`
      );

      contador++;
    }
  }

  if(confrontosOitavasVolta) {
  	$("#placeHolder").append(`<h2 class="jogos-label jogos-oitavas-volta-titulo"># OITAVAS DE FINAL [ VOLTA ]</h2>`);
    $("#placeHolder").append(`<table class=\"grupoJogosItens jogos-oitavas-volta\"></table>`);

    let contador = 1;

    for(let i in confrontosOitavasVolta) {
      let casa = confrontosOitavasVolta[i].casa,
        fora = confrontosOitavasVolta[i].fora;
      $(`#placeHolder table.jogos-oitavas-volta`).append(
        `<tr${contador%2 == 0 ? " class=\"corNao\"": ""}>
          <td class="colRodada">#${confrontosOitavasVolta[i].rodada - 1}</td>
          <td class="colNomeCasa${confrontosOitavasVolta[i].vencedor == casa.id ? " vencedorCasa" : ""}">${casa.nome}${casa.pontos ? "<span class=\"pontosCasa\">( " + casa.pontos.toFixed(2) + " )": ""}</td>
          <td class="colImagemCasa"><img src="${casa.escudo}" width="35" /></td>
          <td class="colVs"><img src="${chrome.extension.getURL("images/vs-" + (contador%2) + ".jpg")}" width="20" /></td>
          <td class="colImagemFora"><img src="${fora.escudo}" width="35" /></td>
          <td class="colNomeFora${confrontosOitavasVolta[i].vencedor == fora.id ? " vencedorFora" : ""}">${fora.nome}${fora.pontos ? "<span class=\"pontosFora\">( " + fora.pontos.toFixed(2) + " )": ""}</td>
        </tr>`
      );

      contador++;
    }
  }

	$(".jogos-ida-titulo, .jogos-volta-titulo").after().click(function() {
		mostrarJogos('jogos-ida', 'jogos-volta', $(this).data("indice"));
	});

  $(".jogos-oitavas-ida-titulo, .jogos-oitavas-volta-titulo").after().click(function() {
		mostrarJogos('jogos-oitavas-ida', 'jogos-oitavas-volta');
	});

	const ultimoJogoFase1Ida = confrontosFase1Ida[confrontosFase1Ida.length - 1][confrontosFase1Ida[0].length - 1];

  // verificar se acabou jogos ida oitavas para mostrar quartas

  if(confrontosOitavasIda) {
    $(".jogos-oitavas-ida-titulo, .jogos-oitavas-ida").show();
    $(".jogos-volta-titulo, .jogos-volta, .jogos-ida-titulo, .jogos-ida, .grupo-label, .grupoItens").hide();
  } else if(ultimoJogoFase1Ida.vencedor) {
		$(".jogos-volta-titulo, .jogos-volta").show();
		$(".jogos-ida-titulo, .jogos-ida").hide();
	}
};