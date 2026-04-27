namespace db.types;

type MovimentTypes  : String(1) enum {
    @title: 'Entrada'
    Entrada = 'E';

    @title: 'Saída'
    Saida = 'S';
}

type MovimentStatus : String(1) enum {
    @title: 'Rejeitado'
    Rejeitado = 'R';

    @title: 'Pendente'
    Pendente = 'P';

    @title: 'Aprovado'
    Aprovado = 'A';

    @title: 'Concluido'
    Concluido = 'C';
};
