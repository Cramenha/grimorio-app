// Grimorio.exe: abre o servidor local do Grimório (runtime\node.exe server.js) sem janela de console e deixa um ícone na bandeja (Abrir / Sair).
// Compilar: construir-exe.mjs (usa o csc.exe do .NET Framework que já vem no Windows).
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Windows.Forms;

static class Grimorio
{
    const int Porta = 3102;

    static bool Rodando()
    {
        try { using (var c = new TcpClient()) { var r = c.BeginConnect("127.0.0.1", Porta, null, null); return r.AsyncWaitHandle.WaitOne(500) && c.Connected; } }
        catch { return false; }
    }

    static void Abrir() { Process.Start(new ProcessStartInfo("http://localhost:" + Porta) { UseShellExecute = true }); }

    [STAThread]
    static void Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        if (Rodando()) { Abrir(); return; } // já está aberto: só abre o navegador

        string node = Path.Combine(dir, "runtime", "node.exe");
        if (!File.Exists(node)) node = "node"; // sem o runtime embutido: usa o Node instalado
        var psi = new ProcessStartInfo(node, "server.js") { WorkingDirectory = dir, UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden };
        Process servidor;
        try { servidor = Process.Start(psi); }
        catch { MessageBox.Show("Não foi possível iniciar o servidor (Node não encontrado).\nCould not start the server (Node not found).", "Grimório do Aventureiro"); return; }

        var menu = new ContextMenuStrip();
        var icone = new NotifyIcon { Icon = SystemIcons.Application, Text = "Grimório do Aventureiro", Visible = true, ContextMenuStrip = menu };
        menu.Items.Add("Abrir / Open", null, (s, e) => Abrir());
        menu.Items.Add("Sair / Quit", null, (s, e) => { try { if (!servidor.HasExited) servidor.Kill(); } catch { } icone.Visible = false; Application.Exit(); });
        icone.DoubleClick += (s, e) => Abrir();

        var espera = new Timer { Interval = 400 };
        int tentativas = 0;
        espera.Tick += (s, e) =>
        {
            if (servidor.HasExited) { espera.Stop(); icone.Visible = false; Application.Exit(); return; }
            if (Rodando()) { espera.Stop(); Abrir(); }
            else if (++tentativas > 50) { espera.Stop(); }
        };
        espera.Start();

        var vigia = new Timer { Interval = 1500 }; // se o servidor fechar (ex.: atualização), o ícone some junto
        vigia.Tick += (s, e) => { if (servidor.HasExited) { icone.Visible = false; Application.Exit(); } };
        vigia.Start();

        Application.Run();
    }
}
