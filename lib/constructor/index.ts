import { TypedEmitter } from "tiny-typed-emitter";
import { DatabaseEvents } from "../typings/enums";

export class Constructor extends TypedEmitter<DatabaseEvents>
{
    constructor ()
    {
        super();
    }
    set () { }
    get () { }
    delete () { }
    all () { }
    static add ( method: string, cb: Function )
    {
        //@ts-ignore
        Constructor.prototype[ method ] = cb;
    }
}
