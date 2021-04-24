function application () {
    this.arDeals = {};
    this.dealIds = [];
    this.contactIds = [];
    this.productIds = [];
    this.obContacts = {};

    this.arCurrSymbols = {
        "RUB" : "&#8381",
        "USD" : "&#36;",
        "EUR" : "&#8364;",
        "KZT" : "&#8376;"
    }
}
//сomment A
application.prototype.displayDealStageButtons = function() {

    var dealHTML = '';

    BX24.callMethod(
        "crm.status.list",
        {
            order: { "SORT": "ASC" },
            filter: { "ENTITY_ID": "DEAL_STAGE" }
        },
        function(result)
        {
            if(result.error())
                console.error(result.error());
            else
            {
                var data = result.data();

                for (indexStage in data) {
                    dealHTML += '<button class="btn btn-success btn-block" onclick="app.displayDealsByStage(\'' + data[indexStage].STATUS_ID + '\', this);">' + data[indexStage].NAME + '</button>';
                }

                if(result.more())
                    result.next();

                $('#stage-btn-block').html(dealHTML);
            }
        }
    );
}
//comment C
application.prototype.displayDealsByStage = function (stage, button) {

    var curapp = this;

    $('#deal-list').html('<i class="fa fa-spinner fa-spin"></i>');
    $('#stage-btn-block .btn.active').removeClass('active');
    $(button).addClass('active');

    $.get( 'https://uttest1.bitrix24.ru/rest/1/demfzvh9s1hbm9lg/crm.deal.list/?filter[STAGE_ID]=' + stage,
        function(data) {
            if (data.result.length > 0) {

                var result = data.result;

                for (indexDeal in result) {
                    curapp.dealIds.push(result[indexDeal].ID);
                    curapp.contactIds.push(result[indexDeal].CONTACT_ID);
                    curapp.arDeals[result[indexDeal].ID]  = {
                        "TITLE" : result[indexDeal].TITLE,
                        "OPPORTUNITY" : result[indexDeal].OPPORTUNITY,
                        "CONTACT_ID" : result[indexDeal].CONTACT_ID,
                        "CURRENCY_ID" : result[indexDeal].CURRENCY_ID,
                        "COMMENTS" : result[indexDeal].COMMENTS
                    };
                }

                curapp.BatchGetData();

            } else {
                $('#deal-list').html('<div class="bs-callout"><h4>Подходящих сделок не найдено!</h4></div>');
            }
        });
}

application.prototype.BatchGetData = function () {

    curapp = this;

    var arCommands = {
        products: {
            method: 'crm.productrow.list',
            params: {
                filter: { "OWNER_TYPE": "D", "OWNER_ID": this.dealIds },
                select: [ "OWNER_ID", "PRODUCT_NAME", "QUANTITY", "MEASURE_NAME", "PRICE" ]
            }
        },
        clients: {
            method: 'crm.contact.list',
            params: {
                filter: {"ID" : this.contactIds},
                select: [ "ID", "NAME", "LAST_NAME"]
            }
        }
    };

    var batchCallback = function(result)
    {

        var productsData = [],
            clientsData = [];
        var arDeals = curapp.arDeals,
            obContacts = curapp.obContacts;

        if (arCommands.hasOwnProperty('products'))
            productsData = result.products.data();
        if (arCommands.hasOwnProperty('clients'))
            clientsData = result.clients.data();

        if (productsData.length > 0 ) {
            for (pIndex in productsData) {

                if (!arDeals[productsData[pIndex].OWNER_ID].hasOwnProperty('PRODUCTS')) {
                    arDeals[productsData[pIndex].OWNER_ID].PRODUCTS = {};
                }
                arDeals[productsData[pIndex].OWNER_ID].PRODUCTS[pIndex] = {};
                arDeals[productsData[pIndex].OWNER_ID].PRODUCTS[pIndex].PRODUCT_NAME = productsData[pIndex].PRODUCT_NAME;
                arDeals[productsData[pIndex].OWNER_ID].PRODUCTS[pIndex].QUANTITY = parseInt(productsData[pIndex].QUANTITY) + " " + productsData[pIndex].MEASURE_NAME;
                arDeals[productsData[pIndex].OWNER_ID].PRODUCTS[pIndex].PRICE = ((productsData[pIndex].PRICE ^ 0) == productsData[pIndex].PRICE) ? parseInt(productsData[pIndex].PRICE) : parseFloat(productsData[pIndex].PRICE).toFixed(2);

            }
        }

        if (clientsData.length > 0 ) {
            for (cIndex in clientsData) {

                obContacts[clientsData[cIndex].ID] = [];
                if (clientsData[cIndex].NAME !== "") obContacts[clientsData[cIndex].ID].push(clientsData[cIndex].NAME);
                if (clientsData[cIndex].LAST_NAME !== "") obContacts[clientsData[cIndex].ID].push(clientsData[cIndex].LAST_NAME);

            }
        }

        var empty = true;
        for (var i in arCommands) {
            if (arCommands.hasOwnProperty(i)) {
                if (result[i].more()) {
                    empty = false;
                    arCommands[i].params.start = result[i].answer.next;
                }
                else delete arCommands[i];
            }
        }

        if (!empty) BX24.callBatch(arCommands, batchCallback);
        else {
            curapp.processUserInterface();
        }
    }

   BX24.callBatch(arCommands, batchCallback);
}

application.prototype.processUserInterface = function () {

    var arDeals = this.arDeals;
    var resultHtml = "",
        CUR = "",
        prodTable = "";

    for (indexDeal in arDeals) {

        CUR = this.arCurrSymbols[arDeals[indexDeal].CURRENCY_ID];

        if (arDeals[indexDeal].hasOwnProperty("PRODUCTS")) {
            prodTable = '<table class="products-table"><tbody>';
            for (var prodIndex in arDeals[indexDeal].PRODUCTS) {
                prodTable += '<tr><td>' + arDeals[indexDeal].PRODUCTS[prodIndex].PRODUCT_NAME +
                    '</td><td>' + arDeals[indexDeal].PRODUCTS[prodIndex].QUANTITY +
                    '</td><td>' + arDeals[indexDeal].PRODUCTS[prodIndex].PRICE + ' ' + CUR + '</tr>';
            }
            prodTable += "</tbody></table>"
        } else {
            prodTable = '<div class="products-empty">Товарные позиции отсутствуют</div>';
        }

        resultHtml +=  '<div class="panel panel-success">' +
            '<div id="deal-list" class="deal-list panel-body">' +
                '<div class="col-sm-5 left-col"><span class="deal-title">' + arDeals[indexDeal].TITLE +'</span><br>' +
                '<span class="deal-price">' + arDeals[indexDeal].OPPORTUNITY + " " + CUR +
                    '</span></div>' +
                    '<div class="col-sm-7">' + prodTable + '</div>';

        if (arDeals[indexDeal].hasOwnProperty('COMMENTS') && arDeals[indexDeal].COMMENTS != "" && arDeals[indexDeal].COMMENTS != null) {
            resultHtml += '<div class="comments col-sm-11"><p>' + arDeals[indexDeal].COMMENTS + '</p></div>';
        }

        if (arDeals[indexDeal].hasOwnProperty('CONTACT_ID') && arDeals[indexDeal].CONTACT_ID != "" && arDeals[indexDeal].CONTACT_ID != null) {
            resultHtml += '<div class="contact-name col-sm-12">' + this.obContacts[arDeals[indexDeal].CONTACT_ID].join(' ') + '</div>';
        }

        resultHtml += '</div></div>';

    }

    $('#deal-list').html(resultHtml);
    this.resizeFrame();

}

application.prototype.resizeFrame = function () {

    var currentSize = BX24.getScrollSize();
    minHeight = currentSize.scrollHeight;

    if (minHeight < 650) minHeight = 650;
    BX24.resizeWindow(this.FrameWidth, minHeight);

}

application.prototype.saveFrameWidth = function () {
    this.FrameWidth = document.getElementById("app").offsetWidth;
}

// create our application
app = new application();
