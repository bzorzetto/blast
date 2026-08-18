class MediaoutCommand {

    static CUE = '800A00818181813881E6E83032ED040000';

    static PLAY = '800A00818181813881E6E83033EE040000';

    static STOP = '800A00818181813881E6E83034EF040000';
    
    static ALIVE = '800900818181813881E6E730BA040000';
     
    static REFRESH = '800A00818181813881E6E83031EC040000';

    static fromString(str) {
        switch(str) {
            case 'CUE': 
                return MediaoutCommand.CUE;
            case 'PLAY':
                return MediaoutCommand.PLAY;
            case 'STOP':
                return MediaoutCommand.STOP;
            case 'ALIVE':
                return MediaoutCommand.ALIVE;
            case 'REFRESH':
                return MediaoutCommand.REFRESH;
        }
    }
}
module.exports=MediaoutCommand;