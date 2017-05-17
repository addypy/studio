var Backbone = require("backbone");
var _ = require("underscore");
var BaseViews = require("edit_channel/views");
var Models = require("edit_channel/models");
require("selected.less");
var stringHelper = require("edit_channel/utils/string_helper");

var RelatedModalView = BaseViews.BaseModalView.extend({
    template: require("./hbtemplates/related_modal.handlebars"),

    initialize: function(options) {
        _.bindAll(this, "close_prerequisites");
        this.onselect = options.onselect;
        this.parent_view = options.parent_view;
        this.collection = options.collection;
        this.views_to_update = options.views_to_update;
        this.modal = true;
        this.render(this.close, {});
        this.related_view = new RelatedView({
            el: this.$(".modal-body"),
            onselect: this.close_prerequisites,
            modal : this,
            model:this.model,
            views_to_update: this.views_to_update,
            collection: this.collection
        });
    },
    close_prerequisites:function(prerequisite_collection){
      this.onselect(prerequisite_collection, this.views_to_update);
      this.close();
    }
});

var RelatedView = BaseViews.BaseListView.extend({
    template: require("./hbtemplates/related_dialog.handlebars"),
    onselect:null,
    lists: [],

    initialize: function(options) {
        this.modal = options.modal;
        this.selected_collection = options.collection;
        this.collection = new Models.ContentNodeCollection();
        this.onselect = options.onselect;
        this.views_to_update = options.views_to_update;
        this.lists=[];
        this.render();
    },
    render: function() {
        this.$el.html(this.template());
        var self = this;

        this.selected_collection.get_prerequisites().then(function(nodes){
            self.collection.get_all_fetch_simplified(window.current_channel.get('main_tree').children).then(function(collection){
                self.collection = collection;
                if(self.collection.length > 0){
                    console.log(nodes)
                    self.relatedList = new RelatedList({
                        model: null,
                        el: self.$(".select_main_box"),
                        collection: self.collection,
                        parent_node_view: null,
                        container: self,
                        filter_list: nodes.postrequisites,
                        prerequisites: nodes.prerequisites
                    });
                }else{
                    self.$(".empty_default").text("No content found");
                }
            });
        });
    },
    update_count:function(skip_update){
        var prerequisite_collection = this.get_selected_collection();
        var totalCount = this.collection.reduce(function(sum, entry){
            return sum + entry.get("metadata").total_count + (entry.get('kind') === 'topic');
        }, 0);
        var count = this.relatedList.get_metadata();
        totalCount = totalCount - count;
        this.$("#select_file_count").html(totalCount + " Topic" + ((totalCount == 1)? ", " : "s, ") + count + " Resource" + ((count == 1)? "" : "s"));
        if(!skip_update){
            this.onselect(prerequisite_collection, this.views_to_update);
        }
    },
    get_selected_collection:function(){
        return new Models.ContentNodeCollection(_.chain(this.lists).pluck('views').flatten().where({'item_to_select': true}).pluck('model').value());
    }
});

var RelatedList = BaseViews.BaseListView.extend({
    template: require("./hbtemplates/related_list.handlebars"),
    default_item:">.default-item",
    list_selector: ">.select-list",
    initialize: function(options) {
        this.collection = options.collection;
        this.container = options.container;
        this.count = 0;
        this.parent_node_view = options.parent_node_view;
        this.filter_list = options.filter_list;
        this.isdisabled = options.isdisabled;
        this.prerequisites = options.prerequisites;
        this.render();
        this.container.lists.push(this);
    },
    render: function() {
        this.$el.html(this.template({ node : this.model }));
        this.load_content();
    },
    create_new_view:function(model){
        var new_view = new RelatedItem({
            containing_list_view: this,
            model: model,
            checked: (this.parent_node_view)? this.parent_node_view.checked : false,
            container: this.container,
            filter_list: this.filter_list,
            prerequisites: this.prerequisites,
            isdisabled: this.isdisabled
        });
        this.views.push(new_view);
        return new_view;
    },
    check_all:function(checked){
        this.views.forEach(function(entry){
            entry.check_item(checked);
            entry.set_disabled(checked);
            if(entry.subcontent_view){ entry.subcontent_view.check_all(checked); }
        });
    },
    update_count:function(skip_update){
        (this.parent_node_view)? this.parent_node_view.update_count(skip_update) : this.container.update_count(skip_update);
    },
    get_metadata:function(){
        this.count = this.views.reduce(function(sum, entry) { return sum + entry.count; }, 0);
        return this.count;
    }
});

var RelatedItem = BaseViews.BaseListNodeItemView.extend({
    template: require("./hbtemplates/related_list_item.handlebars"),
    tagName: "li",
    className: "select_list_item",
    selectedClass: "select-selected",
    collapsedClass: "glyphicon-triangle-top",
    expandedClass: "glyphicon-triangle-bottom",
    list_selector: ">.select-list",
    item_to_select: false,
    getToggler: function () { return this.$("#menu_toggle_" + this.model.id); },
    getSubdirectory: function () {return this.$("#" + this.id() +"_sub"); },
    'id': function() { return "select_item_" + this.model.get("id"); },
    initialize: function(options) {
        this.bind_node_functions();
        this.containing_list_view = options.containing_list_view;
        this.collection = new Models.ContentNodeCollection();
        this.container = options.container;
        this.prerequisites = options.prerequisites;
        this.checked = options.checked;
        this.filter_list = options.filter_list;
        this.isdisabled = options.isdisabled || this.filter_list.contains(this.model);
        this.count = 0;
        this.render();
    },
    events: {
        'click .tog_folder' : 'toggle',
        'click >.select_item_wrapper .select_checkbox' : 'handle_checked'
    },
    render: function() {
        this.$el.html(this.template({
            node:this.model.toJSON(),
            isfolder: this.model.get("kind") === "topic",
            checked: this.prerequisites.contains(this.model),
            isinvalid: this.isdisabled,
        }));
        var self = this;
        _.defer(function(){
            self.handle_checked(true);
            self.$el.find(".select_checkbox").prop("checked", self.checked);
            self.set_disabled(self.checked);
        });
    },
    handle_checked:function(skip_update){
        this.checked =  this.$("#" + this.id() + "_check").is(":checked");
        this.item_to_select = this.checked;
        this.count = (this.checked)? this.model.get("metadata").resource_count : 0;
        if(this.subcontent_view){ this.subcontent_view.check_all(this.checked); }
        this.update_count(skip_update);
    },
    check_item:function(checked){
        this.item_to_select = false;
        this.count = (checked)? this.model.get("metadata").resource_count : 0;
        this.$("#" + this.id() + "_check").prop("checked", checked);
        this.$("#" + this.id() + "_count").text(this.model.get("metadata").resource_count);
        this.$("#" + this.id() + "_count").css("visibility", (checked)?"visible" : "hidden" );
        this.checked = checked;
    },
    load_subfiles:function(){
        var self = this;
        this.collection.get_all_fetch_simplified(this.model.get("children")).then(function(fetched){
            self.subcontent_view = new RelatedList({
                model : this.model,
                el: $(self.getSubdirectory()),
                collection: fetched,
                parent_node_view:self,
                container: self.containing_list_view.container,
                filter_list: self.filter_list,
                isdisabled: self.isdisabled
            });
        });
    },
    set_disabled:function(isDisabled){
        if(isDisabled){
            this.$el.addClass("disabled");
            this.$("#" + this.id() + "_check").attr("disabled", "disabled");
        }else{
            this.$el.removeClass("disabled");
            this.$("#" + this.id() + "_check").removeAttr("disabled");
        }
    },
    update_count:function(skip_update){
        this.count = (this.subcontent_view)? this.subcontent_view.get_metadata() : this.count;
        this.$("#" + this.id() + "_count").css("visibility", (this.count === 0)? "hidden" : "visible");
        this.$("#" + this.id() + "_count").text(this.count);
        this.containing_list_view.update_count(skip_update);
    }
});

module.exports = {
    RelatedModalView: RelatedModalView,
    RelatedView:RelatedView
}